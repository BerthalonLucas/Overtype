use crate::{
    error::{http_status, AppError, ErrorKind},
    probe,
    settings::{normalize_endpoint, Endpoint},
    types::{Server, StreamKind},
};
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

#[derive(Debug, PartialEq)]
pub enum Item {
    Data(String),
    Done,
}

/// One event of the stream at most (a delta is a few hundred bytes): past it without an end, the
/// stream cannot be read (`StreamBroken`) rather than held whole in memory.
const MAX_EVENT: usize = 1024 * 1024;
/// The whole answer at most, far above any text the app captures (`capture::MAX_CHARS`): past
/// it, the output reached a limit and the incomplete result is refused, never pasted (`Length`).
const MAX_RESULT: usize = 16 * 1024 * 1024;
/// The server's refusal is read for its first words only (the retry and the 404 need no more).
const MAX_ERROR_BODY: usize = 64 * 1024;

fn accumulate(result: &mut String, shown: &str) -> Result<(), AppError> {
    if result.len() + shown.len() > MAX_RESULT {
        return Err(AppError::new(
            ErrorKind::Length,
            "La sortie a atteint la limite; résultat incomplet refusé.",
        ));
    }
    result.push_str(shown);
    Ok(())
}

#[derive(Default)]
pub struct SseDecoder {
    buffer: Vec<u8>,
    /// Where the search for a separator resumes: the bytes before it hold none.
    scanned: usize,
}
impl SseDecoder {
    pub fn push(&mut self, bytes: &[u8]) -> Result<Vec<Item>, AppError> {
        self.buffer.extend_from_slice(bytes);
        let mut out = Vec::new();
        let mut start = 0;
        loop {
            // A separator may straddle the last push: back up by its length less one.
            let from = self.scanned.saturating_sub(3).max(start);
            let sep = self.buffer[from..].iter().enumerate().find_map(|(i, b)| {
                let tail = &self.buffer[from + i..];
                match b {
                    b'\n' if tail.starts_with(b"\n\n") => Some((from + i, 2)),
                    b'\r' if tail.starts_with(b"\r\n\r\n") => Some((from + i, 4)),
                    _ => None,
                }
            });
            let Some((end, sep_len)) = sep else {
                self.scanned = self.buffer.len();
                break;
            };
            if end - start > MAX_EVENT {
                return Err(too_large_event());
            }
            let frame = std::str::from_utf8(&self.buffer[start..end])
                .map_err(|_| broken("Le serveur a envoyé un flux UTF-8 invalide."))?;
            let data = frame
                .lines()
                .filter_map(|l| l.strip_prefix("data:"))
                .map(str::trim_start)
                .collect::<Vec<_>>()
                .join("\n");
            start = end + sep_len;
            self.scanned = start;
            if data.is_empty() {
                continue;
            }
            out.push(if data == "[DONE]" {
                Item::Done
            } else {
                Item::Data(data)
            });
        }
        self.buffer.drain(..start);
        self.scanned -= start;
        if self.buffer.len() > MAX_EVENT {
            self.buffer = Vec::new();
            self.scanned = 0;
            return Err(too_large_event());
        }
        Ok(out)
    }
    pub fn finish(self) -> Result<(), AppError> {
        if self.buffer.iter().all(u8::is_ascii_whitespace) {
            Ok(())
        } else {
            Err(broken(
                "Le flux du serveur s’est interrompu au milieu d’un événement.",
            ))
        }
    }
}

pub struct Chunk {
    pub kind: StreamKind,
    pub text: Option<String>,
    pub message: Option<String>,
}

fn too_large_event() -> AppError {
    broken("Le serveur a envoyé un événement trop long.")
}
fn broken(message: &str) -> AppError {
    AppError::new(ErrorKind::StreamBroken, message)
}
fn cancelled() -> AppError {
    AppError::new(ErrorKind::Cancelled, "Traduction annulée.")
}

/// `{base}/v1/{route}` of a server's address (stored without `/v1` since 0.6; one written with
/// it is read the same). An address that is empty or does not read is the address's fault: the
/// error opens its field.
fn api_url(base: &str, route: &str) -> Result<(String, Endpoint), AppError> {
    let endpoint = normalize_endpoint(base).map_err(|reason| {
        AppError::new(
            ErrorKind::BadEndpoint,
            match reason {
                crate::settings::EndpointReason::Empty => {
                    "Aucun serveur n’est réglé. Ouvrez les Réglages."
                }
                _ => "L’adresse du serveur est invalide.",
            },
        )
    })?;
    Ok((format!("{}/v1/{route}", endpoint.base), endpoint))
}

/// Sampling fields beyond the OpenAI contract: understood by vLLM, llama.cpp and most
/// local servers. An endpoint that rejects unknown fields (the OpenAI API answers 400)
/// gets the request once more without them.
const EXTENDED_SAMPLING: [&str; 2] = ["top_k", "repetition_penalty"];
/// vLLM, SGLang and llama.cpp read `chat_template_kwargs`; it switches the thinking of
/// Qwen3 and Gemma 4 off so a small model answers with the text alone. Dropped the same
/// way when a strict endpoint names it.
const THINKING_SWITCH: &str = "chat_template_kwargs";

/// The instruction is the system message, the text the user message (0.4.0): a small
/// instruct model then transforms the text instead of answering it. Sampling is one
/// conservative setting for any LLM (correction and rewriting want little variance).
fn request_body(
    profile: &Server,
    instruction: &str,
    text: &str,
    extended: bool,
    thinking_switch: bool,
) -> Value {
    let mut body = json!({"model":profile.model,
        "messages":[{"role":"system","content":instruction},{"role":"user","content":text}],
        "stream":true,"temperature":0.3,"top_p":0.9});
    if extended {
        body["top_k"] = json!(20);
        body["repetition_penalty"] = json!(1.05);
    }
    if thinking_switch {
        body[THINKING_SWITCH] = json!({"enable_thinking": false});
    }
    body
}

/// A client error whose message names one of the extended fields: strict OpenAI contract.
fn rejects_extended_sampling(status: u16, detail: &str) -> bool {
    (400..500).contains(&status) && EXTENDED_SAMPLING.iter().any(|field| detail.contains(field))
}
fn rejects_thinking_switch(status: u16, detail: &str) -> bool {
    (400..500).contains(&status) && detail.contains(THINKING_SWITCH)
}

/// Holds a leading thinking block back from the stream: `<think>…</think>` (Qwen3 without
/// a reasoning parser) or Gemma's `<|channel>thought…<channel|>`. Deltas are kept while
/// the beginning of the output may still turn into one of those markers.
#[derive(Default)]
pub struct ThinkFilter {
    buffer: String,
    state: ThinkState,
}
#[derive(Default, PartialEq)]
enum ThinkState {
    #[default]
    Start,
    Thinking(&'static str),
    Passing,
}
const THINK_MARKERS: [(&str, &str); 2] =
    [("<think>", "</think>"), ("<|channel>thought", "<channel|>")];
impl ThinkFilter {
    /// Returns what may be shown now.
    pub fn push(&mut self, delta: &str) -> String {
        match self.state {
            ThinkState::Passing => delta.to_string(),
            ThinkState::Thinking(_) | ThinkState::Start => {
                self.buffer.push_str(delta);
                self.drain()
            }
        }
    }
    fn drain(&mut self) -> String {
        loop {
            match self.state {
                ThinkState::Start => {
                    let head = self.buffer.trim_start();
                    if let Some((_, close)) = THINK_MARKERS
                        .iter()
                        .find(|(open, _)| head.starts_with(open))
                    {
                        self.state = ThinkState::Thinking(close);
                        continue;
                    }
                    if head.is_empty()
                        || THINK_MARKERS.iter().any(|(open, _)| open.starts_with(head))
                    {
                        return String::new();
                    }
                    self.state = ThinkState::Passing;
                    return std::mem::take(&mut self.buffer);
                }
                ThinkState::Thinking(close) => {
                    let Some(end) = self.buffer.find(close) else {
                        // Only a start of the end marker can still matter: the rest of the
                        // block is dropped as it arrives.
                        let mut keep = self.buffer.len().saturating_sub(close.len() - 1);
                        while !self.buffer.is_char_boundary(keep) {
                            keep += 1;
                        }
                        self.buffer.drain(..keep);
                        return String::new();
                    };
                    let rest = self.buffer[end + close.len()..].trim_start().to_string();
                    self.buffer = rest;
                    self.state = ThinkState::Start;
                    continue;
                }
                ThinkState::Passing => return std::mem::take(&mut self.buffer),
            }
        }
    }
    /// The end of the stream: an unfinished marker prefix was text after all; an
    /// unclosed thinking block is dropped.
    pub fn finish(&mut self) -> String {
        match self.state {
            ThinkState::Thinking(_) => {
                self.buffer.clear();
                String::new()
            }
            _ => std::mem::take(&mut self.buffer),
        }
    }
}

/// The final result: a code fence wrapping the whole answer is removed, trailing
/// whitespace too. Quotes stay (they may belong to the text).
pub fn clean_output(text: &str) -> String {
    let trimmed = text.trim();
    if let Some(inner) = trimmed.strip_prefix("```") {
        if let Some(body) = inner.strip_suffix("```") {
            let body = body.split_once('\n').map_or("", |(_, rest)| rest);
            return body.trim_end().to_string();
        }
    }
    trimmed.to_string()
}

/// How long a connection may take, then how long the server may stay silent (before the first
/// token: the prompt is read; then between two): no limit on the whole answer, a long text
/// streams as long as it needs (the tests shorten them).
#[derive(Clone, Copy, Debug)]
pub struct Limits {
    pub connect: Duration,
    pub idle: Duration,
}
impl Default for Limits {
    fn default() -> Self {
        Self {
            connect: Duration::from_secs(5),
            idle: Duration::from_secs(120),
        }
    }
}

pub async fn stream<F>(
    profile: Server,
    instruction: String,
    text: String,
    cancel: CancellationToken,
    emit: F,
) -> Result<String, AppError>
where
    F: FnMut(Chunk) -> Result<(), AppError>,
{
    stream_within(profile, instruction, text, cancel, Limits::default(), emit).await
}

/// Every failure carries its code (lot 10): the status of the answer, the transport, the
/// stream, the finish reason. The server's body decides a retry or a 404 and goes nowhere.
pub async fn stream_within<F>(
    profile: Server,
    instruction: String,
    text: String,
    cancel: CancellationToken,
    limits: Limits,
    mut emit: F,
) -> Result<String, AppError>
where
    F: FnMut(Chunk) -> Result<(), AppError>,
{
    let (endpoint, address) = api_url(&profile.endpoint, "chat/completions")?;
    // A server without a model chosen yet (0.6 allows it while setting up): the model's field.
    if profile.model.trim().is_empty() {
        return Err(AppError::new(
            ErrorKind::ModelNotFound,
            "Aucun modèle n’est choisi pour ce serveur.",
        ));
    }
    // A server on this computer is reached directly, whatever proxy the environment names.
    let client = probe::streaming_client(&probe::route(&address), limits.connect, limits.idle)
        .map_err(AppError::internal)?;
    let mut extended = true;
    let mut thinking_switch = true;
    let response = loop {
        let mut req = client.post(&endpoint).json(&request_body(
            &profile,
            &instruction,
            &text,
            extended,
            thinking_switch,
        ));
        if !profile.no_key && !profile.api_key.is_empty() {
            req = req.bearer_auth(&profile.api_key);
        }
        if cancel.is_cancelled() {
            return Err(cancelled());
        }
        let response = tokio::select! {_ = cancel.cancelled()=>return Err(cancelled()),r=req.send()=>r.map_err(|e|transport(&profile.endpoint, &e))?};
        if response.status().is_success() {
            break response;
        }
        let status = response.status().as_u16();
        // The server's own message decides the retry and the 404; it is never logged nor shown.
        // Its first words only, and given up at once on a cancel.
        let detail = match probe::read_bounded(response, &cancel, MAX_ERROR_BODY).await {
            probe::Bounded::Read(body) | probe::Bounded::Truncated(body) => {
                String::from_utf8_lossy(&body).into_owned()
            }
            probe::Bounded::Failed(_) => String::new(),
            probe::Bounded::Cancelled => return Err(cancelled()),
        };
        if extended && rejects_extended_sampling(status, &detail) {
            extended = false;
            continue;
        }
        if thinking_switch && rejects_thinking_switch(status, &detail) {
            thinking_switch = false;
            continue;
        }
        return Err(AppError::new(
            http_status(status, &detail),
            format!("Le serveur a répondu HTTP {status}."),
        ));
    };
    let mut bytes = response.bytes_stream();
    let mut decoder = SseDecoder::default();
    let mut result = String::new();
    let mut filter = ThinkFilter::default();
    let mut done = false;
    let mut stop = false;
    'read: loop {
        tokio::select! {
            _ = cancel.cancelled() => return Err(cancelled()),
            next = bytes.next() => match next {
                Some(Ok(part)) => for item in decoder.push(&part)? {
                    match item {
                        Item::Done => {
                            done = true;
                            // The server announced the end of a complete answer: whether it
                            // closes the connection or not, nothing more is awaited.
                            if stop { break 'read; }
                        }
                        Item::Data(data) => {
                            let value: Value = serde_json::from_str(&data).map_err(|_| broken("Le serveur a envoyé un événement JSON invalide."))?;
                            if let Some(reason) = value.pointer("/choices/0/finish_reason").and_then(Value::as_str) {
                                if reason == "stop" { stop = true; }
                                else if reason == "length" { return Err(AppError::new(ErrorKind::Length, "La sortie a atteint la limite; résultat incomplet refusé.")); }
                                // The reason is the server's word: it decides the code, never the message.
                                else { return Err(AppError::new(ErrorKind::ServerError, "Le serveur a interrompu la génération.")); }
                            }
                            if let Some(delta) = value.pointer("/choices/0/delta/content").and_then(Value::as_str) {
                                let shown = filter.push(delta);
                                if !shown.is_empty() { accumulate(&mut result, &shown)?; emit(Chunk { kind: StreamKind::Delta, text: Some(shown), message: None })?; }
                            }
                        }
                    }
                },
                Some(Err(error)) => return Err(if error.is_timeout() {
                    AppError::new(ErrorKind::Timeout, unreachable_message(&profile.endpoint, ErrorKind::Timeout, Cause::Other))
                } else {
                    broken("Le flux du serveur a été interrompu.")
                }),
                None => break,
            }
        }
    }
    if !(done && stop) {
        decoder.finish()?;
    }
    let tail = filter.finish();
    if !tail.is_empty() {
        accumulate(&mut result, &tail)?;
        emit(Chunk {
            kind: StreamKind::Delta,
            text: Some(tail),
            message: None,
        })?;
    }
    let result = clean_output(&result);
    if !done || !stop {
        return Err(broken("Le serveur n’a pas confirmé une réponse complète."));
    }
    if result.is_empty() {
        // A complete answer with nothing in it (a thinking block alone): the server's.
        return Err(AppError::new(
            ErrorKind::ServerError,
            "Le serveur n’a pas confirmé une réponse complète.",
        ));
    }
    if cancel.is_cancelled() {
        return Err(cancelled());
    }
    Ok(result)
}

/// A request that got no answer: nothing at the address (refused, unknown host, TLS, a
/// connection that never opened in time) or a server that stopped answering in time.
fn transport(endpoint: &str, error: &reqwest::Error) -> AppError {
    if error.is_timeout() && !error.is_connect() {
        return AppError::new(
            ErrorKind::Timeout,
            unreachable_message(endpoint, ErrorKind::Timeout, Cause::Other),
        );
    }
    let cause = if error.is_timeout() {
        Cause::Silent
    } else {
        cause(error)
    };
    AppError::new(
        ErrorKind::Unreachable,
        unreachable_message(endpoint, ErrorKind::Unreachable, cause),
    )
}

/// Why a connection failed (25/09: an endpoint behind a firewall only said « injoignable »). Read
/// from the errors under reqwest's; they are never shown nor logged as they are.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Cause {
    /// Windows refused the server's certificate: its authority, its name or its dates.
    Certificate,
    /// The secure connection failed otherwise: no TLS at the address, or nothing in common.
    Tls,
    /// The name did not resolve.
    Name,
    /// Nothing listens at the address.
    Refused,
    /// No route to the server: the network or a firewall.
    Network,
    /// The connection never opened in time.
    Silent,
    /// The connection was cut while it opened.
    Reset,
    Other,
}

/// The first cause the chain names: an OS code (a socket's WSA code, schannel's SEC_E and
/// CERT_E codes) or a TLS error, whose code std prints as « (os error N) ».
pub(crate) fn cause(error: &(dyn std::error::Error + 'static)) -> Cause {
    let mut next = Some(error);
    while let Some(current) = next {
        next = current.source();
        if let Some(io) = current.downcast_ref::<std::io::Error>() {
            if let Some(found) = io
                .raw_os_error()
                .map(os_cause)
                .filter(|found| *found != Cause::Other)
            {
                return found;
            }
            match io.kind() {
                std::io::ErrorKind::ConnectionRefused => return Cause::Refused,
                std::io::ErrorKind::ConnectionReset | std::io::ErrorKind::ConnectionAborted => {
                    return Cause::Reset
                }
                std::io::ErrorKind::TimedOut => return Cause::Silent,
                _ => {}
            }
            // A wrapping io::Error hides what it wraps from `source`.
            if let Some(inner) = io.get_ref() {
                next = Some(inner);
            }
        }
        if let Some(tls) = current.downcast_ref::<native_tls::Error>() {
            return tls_cause(&tls.to_string());
        }
    }
    Cause::Other
}

pub(crate) fn tls_cause(text: &str) -> Cause {
    let code = text
        .rsplit_once("(os error ")
        .and_then(|(_, tail)| tail.trim_end_matches(')').trim().parse::<i32>().ok());
    match code.map(os_cause) {
        Some(Cause::Certificate) => Cause::Certificate,
        _ => Cause::Tls,
    }
}

fn os_cause(code: i32) -> Cause {
    match code {
        11001..=11004 => Cause::Name,
        10061 => Cause::Refused,
        10051 | 10065 => Cause::Network,
        10060 => Cause::Silent,
        10053 | 10054 => Cause::Reset,
        _ => match code as u32 {
            // CERT_E_*, revocation (CRYPT_E_REVOKED, _NO_REVOCATION_CHECK, _REVOCATION_OFFLINE), a
            // bad signature, and schannel's own certificate codes (wrong name, untrusted root,
            // unknown, expired, wrong usage, untrusted issuing CA).
            0x800B_0101..=0x800B_0114
            | 0x8009_2010
            | 0x8009_2012
            | 0x8009_2013
            | 0x8009_6004
            | 0x8009_0322
            | 0x8009_0325
            | 0x8009_0327
            | 0x8009_0328
            | 0x8009_0349
            | 0x8009_0352 => Cause::Certificate,
            0x8009_0300..=0x8009_03FF => Cause::Tls,
            _ => Cause::Other,
        },
    }
}

/// The raw reqwest text names the full URL and the transport; the glass only
/// needs the host, the cause and what to do about it.
fn unreachable_message(endpoint: &str, kind: ErrorKind, cause: Cause) -> String {
    let target = reqwest::Url::parse(endpoint)
        .ok()
        .and_then(|url| {
            url.host_str().map(|host| match url.port() {
                Some(port) => format!("{host}:{port}"),
                None => host.to_string(),
            })
        })
        .unwrap_or_else(|| "configuré".to_string());
    if kind == ErrorKind::Timeout {
        return format!("Le serveur {target} ne répond pas.");
    }
    match cause {
        Cause::Certificate => format!("Certificat de {target} refusé par Windows : autorité inconnue de ce poste, nom ou dates."),
        Cause::Tls => format!("Connexion sécurisée impossible avec {target} : vérifiez que ce serveur parle bien HTTPS."),
        Cause::Name => format!("Nom {target} introuvable : vérifiez l’adresse ou le DNS de ce poste."),
        Cause::Refused => format!("Serveur {target} injoignable : rien n’écoute à cette adresse. Démarrez-le ou vérifiez l’adresse dans les Réglages."),
        Cause::Network => format!("Serveur {target} injoignable depuis ce poste : réseau ou pare-feu."),
        Cause::Silent => format!("Serveur {target} injoignable : la connexion ne s’ouvre pas à temps (pare-feu ou proxy ?)."),
        Cause::Reset => format!("Serveur {target} injoignable : la connexion a été coupée (pare-feu ou proxy ?)."),
        Cause::Other => format!("Serveur {target} injoignable. Démarrez-le ou vérifiez l’adresse dans les Réglages."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::actions;

    fn instruction() -> String {
        actions::defaults()[0].prompt_template.clone()
    }

    #[test]
    fn the_instruction_is_the_system_message_and_the_extras_are_dropped_on_a_strict_endpoint() {
        let profile = Server {
            endpoint: "http://127.0.0.1:8001".into(),
            model: "m".into(),
            ..Server::default()
        };
        let full = request_body(&profile, "Fix it.", "the txt", true, true);
        assert_eq!(full["messages"][0]["role"], "system");
        assert_eq!(full["messages"][0]["content"], "Fix it.");
        assert_eq!(full["messages"][1]["role"], "user");
        assert_eq!(full["messages"][1]["content"], "the txt");
        assert_eq!(full["top_k"], 20);
        assert_eq!(full["repetition_penalty"], 1.05);
        assert_eq!(full["chat_template_kwargs"]["enable_thinking"], false);
        let strict = request_body(&profile, "p", "t", false, false);
        assert!(strict.get("top_k").is_none());
        assert!(strict.get("repetition_penalty").is_none());
        assert!(strict.get("chat_template_kwargs").is_none());
        assert_eq!(strict["temperature"], 0.3);
        assert_eq!(strict["stream"], true);
        assert!(rejects_extended_sampling(
            400,
            "Unrecognized request argument supplied: top_k"
        ));
        assert!(rejects_extended_sampling(
            422,
            "repetition_penalty: extra inputs are not permitted"
        ));
        assert!(!rejects_extended_sampling(400, "model not found"));
        assert!(!rejects_extended_sampling(500, "top_k"));
        assert!(rejects_thinking_switch(
            400,
            "Unrecognized request argument supplied: chat_template_kwargs"
        ));
        assert!(!rejects_thinking_switch(400, "top_k"));
    }
    #[test]
    fn a_leading_thinking_block_is_held_back_and_the_answer_streams_after_it() {
        let mut filter = ThinkFilter::default();
        assert_eq!(filter.push("<thi"), "");
        assert_eq!(filter.push("nk>\nlet me see"), "");
        assert_eq!(filter.push(" more</think>\n\nBonjour"), "Bonjour");
        assert_eq!(filter.push(" le monde"), " le monde");
        assert_eq!(filter.finish(), "");
        let mut gemma = ThinkFilter::default();
        assert_eq!(gemma.push("<|channel>thought\nhmm<channel|>Salut"), "Salut");
        let mut plain = ThinkFilter::default();
        assert_eq!(plain.push("<"), "");
        assert_eq!(plain.push("bold>"), "<bold>");
        let mut cut = ThinkFilter::default();
        assert_eq!(cut.push("<think>never closed"), "");
        assert_eq!(cut.finish(), "");
        let mut prefix = ThinkFilter::default();
        assert_eq!(prefix.push("<th"), "");
        assert_eq!(prefix.finish(), "<th");
    }
    #[test]
    fn the_final_text_loses_a_wrapping_fence_and_trailing_space_but_keeps_its_quotes() {
        assert_eq!(clean_output("```text\nBonjour\n```"), "Bonjour");
        assert_eq!(clean_output("```\nBonjour\n```\n"), "Bonjour");
        assert_eq!(clean_output("« Bonjour »  \n"), "« Bonjour »");
        assert_eq!(clean_output("\n\nBonjour\nmonde\n"), "Bonjour\nmonde");
    }
    #[tokio::test]
    #[ignore = "requires a running local FlowTranslate vLLM profile"]
    async fn live_vllm_stream_and_cancel() {
        let mode = std::env::var("FLOWTRANSLATE_TEST_PROFILE").unwrap_or_else(|_| "fast".into());
        assert!(matches!(mode.as_str(), "fast" | "quality"));
        let profile = Server {
            endpoint: format!(
                "http://127.0.0.1:{}",
                if mode == "fast" { 8001 } else { 8002 }
            ),
            model: format!("flowtranslate-{mode}"),
            ..Server::default()
        };
        let mut deltas = String::new();
        let result = stream(
            profile.clone(),
            instruction(),
            "Please confirm the budget of 1250 EUR for project Orion.".into(),
            CancellationToken::new(),
            |chunk| {
                if let Some(text) = chunk.text {
                    deltas.push_str(&text);
                }
                Ok(())
            },
        )
        .await
        .expect("live native streaming translation");
        assert_eq!(result, deltas);
        assert!(result.contains("Orion") && result.contains("EUR"));
        let cancel = CancellationToken::new();
        let trigger = cancel.clone();
        let cancelled = stream(profile, instruction(), "Please translate this message carefully and confirm that the delivery is scheduled for Thursday morning.".into(), cancel, |chunk| {
            if chunk.text.is_some() { trigger.cancel(); }
            Ok(())
        }).await;
        assert_eq!(cancelled.unwrap_err().kind, ErrorKind::Cancelled);
    }
    #[test]
    fn fragmented_utf8_and_frames() {
        let mut d = SseDecoder::default();
        let line = "data: {\"choices\":[{\"delta\":{\"content\":\"é\"}}]}\n\n".as_bytes();
        let split = line.iter().position(|b| *b == 0xc3).unwrap() + 1;
        assert!(d.push(&line[..split]).unwrap().is_empty());
        assert_eq!(d.push(&line[split..]).unwrap().len(), 1);
        assert!(d.finish().is_ok());
    }
    #[test]
    fn truncated_frame_refused() {
        let mut d = SseDecoder::default();
        d.push(b"data: {\"x\":").unwrap();
        assert!(d.finish().is_err());
    }
    #[test]
    fn v1_is_added_once_whatever_the_address_was_saved_as() {
        for base in [
            "http://127.0.0.1:8001",
            "http://127.0.0.1:8001/",
            "http://127.0.0.1:8001/v1",
            "http://127.0.0.1:8001/v1/",
        ] {
            assert_eq!(
                api_url(base, "models").unwrap().0,
                "http://127.0.0.1:8001/v1/models",
                "{base}"
            );
        }
        assert_eq!(
            api_url("https://llm.exemple.com/openai", "chat/completions")
                .unwrap()
                .0,
            "https://llm.exemple.com/openai/v1/chat/completions"
        );
        assert_eq!(
            api_url("", "models").unwrap_err().kind,
            ErrorKind::BadEndpoint
        );
    }
    #[test]
    fn crlf_frame_is_supported() {
        let mut d = SseDecoder::default();
        assert_eq!(d.push(b"data: [DONE]\r\n\r\n").unwrap(), vec![Item::Done]);
    }

    // A fake OpenAI server (lot 10): every connection gets the same raw answer, after its
    // request was read; `hold` keeps the connection open without answering (a server that
    // stopped). Nothing real is ever contacted: 127.0.0.1 only, a port of our own.
    fn fake_server(answer: Vec<u8>, hold: bool) -> String {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for connection in listener.incoming() {
                let Ok(mut connection) = connection else {
                    break;
                };
                let answer = answer.clone();
                std::thread::spawn(move || {
                    let mut head = Vec::new();
                    let mut byte = [0u8; 1];
                    while !head.ends_with(b"\r\n\r\n")
                        && connection.read(&mut byte).is_ok_and(|n| n == 1)
                    {
                        head.push(byte[0]);
                    }
                    let length = String::from_utf8_lossy(&head)
                        .lines()
                        .find_map(|line| {
                            line.to_ascii_lowercase()
                                .strip_prefix("content-length:")
                                .map(|v| v.trim().parse::<usize>().unwrap_or(0))
                        })
                        .unwrap_or(0);
                    let mut body = vec![0u8; length];
                    let _ = connection.read_exact(&mut body);
                    if hold {
                        std::thread::sleep(std::time::Duration::from_secs(5));
                        return;
                    }
                    let _ = connection.write_all(&answer);
                    let _ = connection.flush();
                });
            }
        });
        format!("http://127.0.0.1:{port}/v1")
    }
    fn status(code: u16, body: &str) -> Vec<u8> {
        format!("HTTP/1.1 {code} Status\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).into_bytes()
    }
    fn events(body: &str) -> Vec<u8> {
        format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\n{body}"
        )
        .into_bytes()
    }
    const DELTA: &str = "data: {\"choices\":[{\"delta\":{\"content\":\"Bonjour\"}}]}\n\n";
    fn finish(reason: &str) -> String {
        format!("data: {{\"choices\":[{{\"delta\":{{}},\"finish_reason\":\"{reason}\"}}]}}\n\n")
    }
    fn profile(endpoint: String) -> Server {
        Server {
            id: "s1".into(),
            endpoint,
            model: "m".into(),
            ..Server::default()
        }
    }
    async fn run_with(
        endpoint: String,
        cancel: CancellationToken,
        limits: Limits,
    ) -> Result<String, AppError> {
        stream_within(
            profile(endpoint),
            "Fix it.".into(),
            "texte".into(),
            cancel,
            limits,
            |_| Ok(()),
        )
        .await
    }
    async fn run(endpoint: String) -> Result<String, AppError> {
        run_with(
            endpoint,
            CancellationToken::new(),
            Limits {
                connect: Duration::from_secs(2),
                idle: Duration::from_secs(5),
            },
        )
        .await
    }
    async fn code(endpoint: String) -> ErrorKind {
        run(endpoint).await.expect_err("an error").kind
    }

    #[tokio::test]
    async fn every_server_failure_carries_its_code_and_never_the_servers_words() {
        // The complete answer first: no code at all.
        let ok = fake_server(
            events(&format!("{DELTA}{}data: [DONE]\n\n", finish("stop"))),
            false,
        );
        assert_eq!(run(ok).await.unwrap(), "Bonjour");
        // Statuses: the body only splits the 404, and never reaches the message.
        let secret = "The model `m` does not exist. SECRET-BODY";
        for (answer, expected) in [
            (status(401, "{}"), ErrorKind::Unauthorized),
            (status(403, "{}"), ErrorKind::Unauthorized),
            (
                status(404, &format!("{{\"message\":\"{secret}\"}}")),
                ErrorKind::ModelNotFound,
            ),
            (
                status(404, "{\"detail\":\"Not Found\"}"),
                ErrorKind::BadEndpoint,
            ),
            (status(301, ""), ErrorKind::BadEndpoint),
            (status(429, "{}"), ErrorKind::Busy),
            (status(503, "{}"), ErrorKind::Busy),
            (status(500, "{}"), ErrorKind::ServerError),
            (
                status(400, "{\"error\":\"bad request\"}"),
                ErrorKind::ServerError,
            ),
        ] {
            let error = run(fake_server(answer, false))
                .await
                .expect_err("a refused request");
            assert_eq!(error.kind, expected);
            assert!(
                !error.message.contains("SECRET") && !error.message.contains("model `m`"),
                "the body stays out of the message"
            );
        }
        // The stream: the token limit, another finish reason (the server's word stays out),
        // an unreadable event, a cut in the middle of an event, no [DONE], a body cut short.
        assert_eq!(
            code(fake_server(
                events(&format!("{DELTA}{}", finish("length"))),
                false
            ))
            .await,
            ErrorKind::Length
        );
        let filtered = run(fake_server(
            events(&format!("{DELTA}{}", finish("content_filter"))),
            false,
        ))
        .await
        .unwrap_err();
        assert_eq!(filtered.kind, ErrorKind::ServerError);
        assert!(!filtered.message.contains("content_filter"));
        assert_eq!(
            code(fake_server(events("data: {not json}\n\n"), false)).await,
            ErrorKind::StreamBroken
        );
        assert_eq!(
            code(fake_server(
                events(&format!("{DELTA}data: {{\"choices\":")),
                false
            ))
            .await,
            ErrorKind::StreamBroken
        );
        assert_eq!(
            code(fake_server(events(DELTA), false)).await,
            ErrorKind::StreamBroken
        );
        let short = format!("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: 4000\r\n\r\n{DELTA}").into_bytes();
        assert_eq!(
            code(fake_server(short, false)).await,
            ErrorKind::StreamBroken
        );
        // A complete answer with nothing in it (a thinking block alone).
        let empty = "data: {\"choices\":[{\"delta\":{\"content\":\"<think>hmm</think>\"}}]}\n\n";
        assert_eq!(
            code(fake_server(
                events(&format!("{empty}{}data: [DONE]\n\n", finish("stop"))),
                false
            ))
            .await,
            ErrorKind::ServerError
        );
    }

    #[tokio::test]
    async fn transport_cancellation_and_our_own_failures_carry_their_codes() {
        // Nothing listens: a port taken then released.
        let closed = {
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            listener.local_addr().unwrap().port()
        };
        assert_eq!(
            code(format!("http://127.0.0.1:{closed}/v1")).await,
            ErrorKind::Unreachable
        );
        // A server that accepts and never answers.
        let silent = fake_server(Vec::new(), true);
        let timeout = run_with(
            silent,
            CancellationToken::new(),
            Limits {
                connect: Duration::from_secs(2),
                idle: Duration::from_millis(400),
            },
        )
        .await
        .unwrap_err();
        assert_eq!(timeout.kind, ErrorKind::Timeout);
        // An address that does not read, no address at all (nothing set up), and no model chosen:
        // each opens its field, and nothing leaves this computer.
        assert_eq!(
            code("ftp://example.test/v1".into()).await,
            ErrorKind::BadEndpoint
        );
        assert_eq!(
            code("https://user:pw@example.test".into()).await,
            ErrorKind::BadEndpoint
        );
        assert_eq!(code(String::new()).await, ErrorKind::BadEndpoint);
        let unchosen = Server {
            model: "  ".into(),
            ..profile("http://127.0.0.1:9".into())
        };
        let error = stream_within(
            unchosen,
            "p".into(),
            "t".into(),
            CancellationToken::new(),
            Limits::default(),
            |_| Ok(()),
        )
        .await
        .unwrap_err();
        assert_eq!(error.kind, ErrorKind::ModelNotFound);
        // Cancelled before the request left.
        let cancel = CancellationToken::new();
        cancel.cancel();
        let ok = fake_server(
            events(&format!("{DELTA}{}data: [DONE]\n\n", finish("stop"))),
            false,
        );
        assert_eq!(
            run_with(ok.clone(), cancel, Limits::default())
                .await
                .unwrap_err()
                .kind,
            ErrorKind::Cancelled
        );
        // The display failed on our side while the answer streamed.
        let ours = stream_within(
            profile(ok),
            "p".into(),
            "t".into(),
            CancellationToken::new(),
            Limits::default(),
            |_| Err(AppError::internal("Flux d’affichage indisponible.")),
        )
        .await;
        assert_eq!(ours.unwrap_err().kind, ErrorKind::Internal);
    }

    // The same fake server, which keeps the connection open for `open` after its answer (a
    // server that does not close after [DONE], or a body that never ends).
    fn lingering_server(answer: Vec<u8>, open: Duration) -> String {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for connection in listener.incoming() {
                let Ok(mut connection) = connection else {
                    break;
                };
                let answer = answer.clone();
                std::thread::spawn(move || {
                    let mut head = Vec::new();
                    let mut byte = [0u8; 1];
                    while !head.ends_with(b"\r\n\r\n")
                        && connection.read(&mut byte).is_ok_and(|n| n == 1)
                    {
                        head.push(byte[0]);
                    }
                    let length = String::from_utf8_lossy(&head)
                        .lines()
                        .find_map(|line| {
                            line.to_ascii_lowercase()
                                .strip_prefix("content-length:")
                                .map(|v| v.trim().parse::<usize>().unwrap_or(0))
                        })
                        .unwrap_or(0);
                    let mut body = vec![0u8; length];
                    let _ = connection.read_exact(&mut body);
                    let _ = connection.write_all(&answer);
                    let _ = connection.flush();
                    std::thread::sleep(open);
                });
            }
        });
        format!("http://127.0.0.1:{port}/v1")
    }
    fn patient() -> Limits {
        Limits {
            connect: Duration::from_secs(2),
            idle: Duration::from_secs(5),
        }
    }

    #[tokio::test]
    async fn a_stop_then_done_ends_the_answer_even_when_the_server_keeps_the_socket_open() {
        let open = lingering_server(
            events(&format!("{DELTA}{}data: [DONE]\n\n", finish("stop"))),
            Duration::from_secs(10),
        );
        let started = std::time::Instant::now();
        let result = run_with(open, CancellationToken::new(), patient()).await;
        assert_eq!(result.unwrap(), "Bonjour");
        assert!(
            started.elapsed() < Duration::from_secs(1),
            "{:?}",
            started.elapsed()
        );
    }

    #[tokio::test]
    async fn a_done_without_stop_is_still_refused() {
        let error = run(fake_server(
            events(&format!("{DELTA}data: [DONE]\n\n")),
            false,
        ))
        .await
        .unwrap_err();
        assert_eq!(error.kind, ErrorKind::StreamBroken);
    }

    #[test]
    fn an_event_without_end_past_the_ceiling_is_refused_without_growing() {
        let mut d = SseDecoder::default();
        let chunk = vec![b'a'; 64 * 1024];
        let mut refused = false;
        for _ in 0..64 {
            match d.push(&chunk) {
                Ok(items) => assert!(items.is_empty()),
                Err(error) => {
                    assert_eq!(error.kind, ErrorKind::StreamBroken);
                    refused = true;
                    break;
                }
            }
            assert!(d.buffer.len() <= MAX_EVENT + chunk.len());
        }
        assert!(refused, "a 4 MiB event without end is refused");
        // Frames that keep arriving whole are not limited by the ceiling as a total.
        let mut d = SseDecoder::default();
        for _ in 0..4096 {
            assert_eq!(d.push(DELTA.as_bytes()).unwrap().len(), 1);
        }
        // A separator split between two pushes is still found.
        let mut d = SseDecoder::default();
        assert!(d.push(b"data: x\r\n").unwrap().is_empty());
        assert_eq!(d.push(b"\r\n").unwrap(), vec![Item::Data("x".into())]);
    }

    #[test]
    fn an_unclosed_thinking_block_keeps_only_what_the_end_marker_needs() {
        let mut filter = ThinkFilter::default();
        assert_eq!(filter.push("<think>"), "");
        let long = "réflexion ".repeat(1024);
        for _ in 0..200 {
            assert_eq!(filter.push(&long), "");
            assert!(filter.buffer.len() < 16, "{}", filter.buffer.len());
        }
        // A marker split across two deltas is still found.
        assert_eq!(filter.push("</thi"), "");
        assert_eq!(filter.push("nk>Bonjour"), "Bonjour");
        let mut gemma = ThinkFilter::default();
        assert_eq!(gemma.push("<|channel>thought"), "");
        assert_eq!(gemma.push(&"é".repeat(5000)), "");
        assert!(gemma.buffer.len() < 16);
        assert_eq!(gemma.push("<chan"), "");
        assert_eq!(gemma.push("nel|>Salut"), "Salut");
    }

    #[tokio::test]
    async fn a_huge_error_body_is_read_in_part_and_fast() {
        // A 404 whose first words name the model, then a body that never ends in time.
        let mut answer = b"HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\nContent-Length: 100000000\r\n\r\n{\"message\":\"The model `m` does not exist.\"".to_vec();
        answer.extend(std::iter::repeat_n(b' ', 256 * 1024));
        let server = lingering_server(answer, Duration::from_secs(10));
        let started = std::time::Instant::now();
        let error = run_with(server, CancellationToken::new(), patient())
            .await
            .unwrap_err();
        assert_eq!(error.kind, ErrorKind::ModelNotFound);
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "{:?}",
            started.elapsed()
        );
    }

    #[tokio::test]
    async fn a_cancel_while_the_error_body_is_read_answers_at_once() {
        let answer = b"HTTP/1.1 500 Error\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n{\"err".to_vec();
        let server = lingering_server(answer, Duration::from_secs(10));
        let cancel = CancellationToken::new();
        let trigger = cancel.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(300)).await;
            trigger.cancel();
        });
        let started = std::time::Instant::now();
        let error = run_with(server, cancel, patient()).await.unwrap_err();
        assert_eq!(error.kind, ErrorKind::Cancelled);
        assert!(
            started.elapsed() < Duration::from_secs(1),
            "{:?}",
            started.elapsed()
        );
    }

    #[test]
    fn a_result_past_its_ceiling_is_refused() {
        let mut result = String::new();
        assert!(accumulate(&mut result, &"a".repeat(MAX_RESULT)).is_ok());
        assert_eq!(
            accumulate(&mut result, "b").unwrap_err().kind,
            ErrorKind::Length
        );
        assert_eq!(result.len(), MAX_RESULT);
    }

    #[test]
    fn a_failed_connection_names_its_cause_from_the_windows_codes() {
        assert_eq!(os_cause(11001), Cause::Name);
        assert_eq!(os_cause(11004), Cause::Name);
        assert_eq!(os_cause(10061), Cause::Refused);
        assert_eq!(os_cause(10065), Cause::Network);
        assert_eq!(os_cause(10060), Cause::Silent);
        assert_eq!(os_cause(10054), Cause::Reset);
        // CERT_E_UNTRUSTEDROOT, CERT_E_CHAINING, CERT_E_EXPIRED, SEC_E_UNTRUSTED_ROOT, SEC_E_WRONG_PRINCIPAL.
        for hresult in [
            0x800B_0109u32,
            0x800B_010A,
            0x800B_0101,
            0x8009_0325,
            0x8009_0322,
        ] {
            assert_eq!(os_cause(hresult as i32), Cause::Certificate, "{hresult:#x}");
        }
        // SEC_E_ILLEGAL_MESSAGE, SEC_E_ALGORITHM_MISMATCH: TLS, not the certificate.
        assert_eq!(os_cause(0x8009_0326u32 as i32), Cause::Tls);
        assert_eq!(os_cause(0x8009_0331u32 as i32), Cause::Tls);
        assert_eq!(os_cause(5), Cause::Other);
        // What std prints for schannel's code, whatever the language of Windows' own words.
        assert_eq!(tls_cause("Une chaîne de certificats a été émise par une autorité non approuvée. (os error -2146762487)"), Cause::Certificate);
        assert_eq!(
            tls_cause(
                "The message received was unexpected or badly formatted. (os error -2146893018)"
            ),
            Cause::Tls
        );
        assert_eq!(tls_cause("handshake failed"), Cause::Tls);
        // The message keeps the host and never the path.
        let message = unreachable_message(
            "https://inference.example.test:8443/v1",
            ErrorKind::Unreachable,
            Cause::Certificate,
        );
        assert!(
            message.contains("inference.example.test:8443")
                && message.contains("Certificat")
                && !message.contains("/v1")
        );
    }

    #[tokio::test]
    async fn an_unreachable_server_says_why() {
        // Nothing listens: a port taken then released (Windows takes about 2 s to say so).
        let closed = {
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            listener.local_addr().unwrap().port()
        };
        let patient = Limits {
            connect: Duration::from_secs(5),
            idle: Duration::from_secs(8),
        };
        let refused = run_with(
            format!("http://127.0.0.1:{closed}/v1"),
            CancellationToken::new(),
            patient,
        )
        .await
        .unwrap_err();
        assert_eq!(refused.kind, ErrorKind::Unreachable);
        assert!(
            refused.message.contains("rien n’écoute"),
            "{}",
            refused.message
        );
        // A name that never resolves (.invalid is reserved for that).
        let unknown = run("https://flowtranslate-test.invalid/v1".into())
            .await
            .unwrap_err();
        assert_eq!(unknown.kind, ErrorKind::Unreachable);
        assert!(
            unknown.message.contains("introuvable"),
            "{}",
            unknown.message
        );
        // HTTPS to a server that answers plain HTTP at once: the handshake fails.
        let plain = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = plain.local_addr().unwrap().port();
        std::thread::spawn(move || {
            use std::io::Write;
            for connection in plain.incoming() {
                let Ok(mut connection) = connection else {
                    break;
                };
                let _ = connection.write_all(
                    b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                );
            }
        });
        let tls = run(format!("https://127.0.0.1:{port}/v1"))
            .await
            .unwrap_err();
        assert_eq!(tls.kind, ErrorKind::Unreachable);
        assert!(
            tls.message.contains("Connexion sécurisée impossible"),
            "{}",
            tls.message
        );
    }

    /// Real certificates Windows refuses and a public one it accepts (badssl.com, example.com):
    /// needs the Internet, run by hand with `cargo test -- --ignored certificates`.
    #[tokio::test]
    #[ignore = "reaches badssl.com and example.com"]
    async fn windows_refuses_bad_certificates_and_accepts_a_public_one() {
        for host in [
            "self-signed.badssl.com",
            "untrusted-root.badssl.com",
            "expired.badssl.com",
            "wrong.host.badssl.com",
        ] {
            let error = run(format!("https://{host}/v1")).await.unwrap_err();
            assert_eq!(error.kind, ErrorKind::Unreachable, "{host}");
            assert!(
                error.message.starts_with("Certificat de"),
                "{host}: {}",
                error.message
            );
        }
        // A public certificate: TLS passes, the server then answers 404 on /v1/models.
        let public = run("https://example.com/v1".into()).await.unwrap_err();
        assert_ne!(public.kind, ErrorKind::Unreachable, "{}", public.message);
    }
}
