//! The connection check of 0.6 (docs/PLAN-0.6.md §2.1): what the setup and Settings › Server
//! run on the address being typed. Four steps, each with its own time, streamed as they change:
//!
//!   address (the address reads, its name resolves) → reach (TCP, then TLS for https) →
//!   key (the first authenticated request) → models (the list of GET {base}/v1/models)
//!
//! Rust sends codes, never sentences: the interface translates a `StepDetail` and a
//! `ProbeCause`. `technical` is the system's own text for a failure (never a response body),
//! scrubbed of the key. Every step writes one line of the journal (`diagnostics.rs`).
//! Nothing here ever carries a source text; « Essayer avec une phrase » sends one fixed,
//! synthetic sentence and its reply is returned, never logged.
use crate::{
    diagnostics::{key_tail, Diag, DiagLevel, DiagStep},
    inference::{self, Cause},
    settings::{normalize_endpoint, Endpoint, EndpointReason},
};
use serde::Serialize;
use serde_json::{json, Value};
use std::time::{Duration, Instant};
use tokio_util::sync::CancellationToken;

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum StepId {
    Address,
    Reach,
    Key,
    Models,
    /// « Essayer avec une phrase »: never a row of the trace, only the step of a problem.
    Try,
}
impl StepId {
    fn diag(self) -> DiagStep {
        match self { Self::Address => DiagStep::Address, Self::Reach => DiagStep::Reach, Self::Key => DiagStep::Key, Self::Models => DiagStep::Models, Self::Try => DiagStep::Try }
    }
}
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum StepState {
    Waiting,
    Running,
    Ok,
    Error,
    Skipped,
}
/// What a row says once it succeeded.
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum StepDetail {
    /// The name resolved (or the address is an IP of another machine).
    Found { host: String },
    /// This computer.
    Local { host: String },
    /// HTTPS, certificate accepted by Windows.
    Tls,
    /// Plain HTTP on this computer.
    HttpLocal,
    /// Plain HTTP to another machine: « Connexion non chiffrée ».
    HttpInsecure,
    /// The key was sent and the server answered; `tail`: its four last characters (may be empty).
    KeyAccepted { tail: String },
    /// « Mon serveur n'a pas de clé », and the server asked for none.
    KeyNone,
    /// No key typed, and the server asked for none.
    KeyNotAsked,
    Models { count: usize },
}
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct ProbeStep {
    pub id: StepId,
    pub state: StepState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<StepDetail>,
}

/// Why a check or a try failed. The interface has a title and a gesture for each.
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
pub enum ProbeCause {
    #[serde(rename = "address.empty")] AddressEmpty,
    #[serde(rename = "address.malformed")] AddressMalformed,
    #[serde(rename = "address.scheme")] AddressScheme,
    #[serde(rename = "address.credentials")] AddressCredentials,
    #[serde(rename = "address.dns")] AddressDns,
    #[serde(rename = "reach.refused")] ReachRefused,
    #[serde(rename = "reach.timeout")] ReachTimeout,
    /// The secure connection failed: no TLS at the address, or nothing in common.
    #[serde(rename = "reach.tls")] ReachTls,
    /// Windows refused the server's certificate (self-signed, unknown authority, name, dates).
    #[serde(rename = "reach.certificate")] ReachCertificate,
    #[serde(rename = "reach.network")] ReachNetwork,
    #[serde(rename = "key.required")] KeyRequired,
    #[serde(rename = "key.rejected")] KeyRejected,
    #[serde(rename = "models.notfound")] ModelsNotFound,
    #[serde(rename = "models.empty")] ModelsEmpty,
    #[serde(rename = "models.invalid")] ModelsInvalid,
    #[serde(rename = "models.server")] ModelsServer,
    #[serde(rename = "try.model")] TryModel,
    #[serde(rename = "try.rejected")] TryRejected,
    #[serde(rename = "try.server")] TryServer,
    #[serde(rename = "try.timeout")] TryTimeout,
    #[serde(rename = "try.empty")] TryEmpty,
    #[serde(rename = "cancelled")] Cancelled,
}
impl ProbeCause {
    pub fn code(self) -> String {
        serde_json::to_value(self).ok().and_then(|value| value.as_str().map(str::to_string)).unwrap_or_default()
    }
    fn of_address(reason: EndpointReason) -> Self {
        match reason {
            EndpointReason::Empty => Self::AddressEmpty,
            EndpointReason::Malformed => Self::AddressMalformed,
            EndpointReason::Scheme => Self::AddressScheme,
            EndpointReason::Credentials => Self::AddressCredentials,
        }
    }
    /// A connection that failed, by what the system said of it.
    fn of_transport(cause: Cause) -> Self {
        match cause {
            Cause::Name => Self::AddressDns,
            Cause::Refused => Self::ReachRefused,
            Cause::Silent => Self::ReachTimeout,
            Cause::Certificate => Self::ReachCertificate,
            Cause::Tls => Self::ReachTls,
            Cause::Network | Cause::Reset | Cause::Other => Self::ReachNetwork,
        }
    }
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProbeProblem {
    pub step: StepId,
    pub cause: ProbeCause,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<u16>,
    /// The system's own words (an OS error), scrubbed; never a response body.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub technical: Option<String>,
    /// The journal entry of the failure: « Voir le journal » opens on it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_id: Option<u64>,
}
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub owned_by: Option<String>,
}
/// `{ ok: true, …Endpoint }` or `{ ok: false, reason }`, as `NormalizedEndpoint` in src/types.ts.
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(untagged)]
pub enum NormalizedEndpoint {
    Valid { ok: bool, #[serde(flatten)] endpoint: Endpoint },
    Invalid { ok: bool, reason: EndpointReason },
}
impl NormalizedEndpoint {
    pub fn of(input: &str) -> Self {
        match normalize_endpoint(input) {
            Ok(endpoint) => Self::Valid { ok: true, endpoint },
            Err(reason) => Self::Invalid { ok: false, reason },
        }
    }
}
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProbeResult {
    pub run: String,
    pub ok: bool,
    pub endpoint: NormalizedEndpoint,
    pub steps: Vec<ProbeStep>,
    pub models: Vec<ModelInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub problem: Option<ProbeProblem>,
    pub total_ms: u64,
}
/// `{ run, ok: true, reply, ms }` or `{ run, ok: false, problem }`.
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TryResult {
    pub run: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub problem: Option<ProbeProblem>,
}
/// `probe-step`: the whole trace at each change, for the window that started the check.
#[derive(Clone, Debug, Serialize)]
pub struct ProbeStepEvent {
    pub run: String,
    pub steps: Vec<ProbeStep>,
}

/// How long each part may take (the tests shorten them).
#[derive(Clone, Copy, Debug)]
pub struct Limits {
    pub resolve: Duration,
    pub connect: Duration,
    /// The whole GET /v1/models, once connected (plan: 10 s; 0.5 gave it 5 s).
    pub request: Duration,
    /// « Essayer avec une phrase ».
    pub attempt: Duration,
}
impl Default for Limits {
    fn default() -> Self {
        Self { resolve: Duration::from_secs(5), connect: Duration::from_secs(5), request: Duration::from_secs(10), attempt: Duration::from_secs(30) }
    }
}

/// How a request leaves this computer: straight to the server, or through the proxy of the
/// environment (`HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`: what reqwest follows in this build).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Route {
    Direct,
    Proxy(String),
}
impl Route {
    /// As the journal writes it: `system: <host>`, or nothing for a direct request.
    pub fn label(&self) -> Option<String> {
        match self { Self::Direct => None, Self::Proxy(host) => Some(format!("system: {host}")) }
    }
}

/// The proxy of the environment for this address, read as reqwest reads it; a server on this
/// computer is always reached directly (a proxy cannot see this machine's loopback).
pub fn route(endpoint: &Endpoint) -> Route {
    route_from(endpoint, |name| std::env::var(name).ok().filter(|value| !value.trim().is_empty()))
}
fn route_from(endpoint: &Endpoint, env: impl Fn(&str) -> Option<String>) -> Route {
    if endpoint.local { return Route::Direct; }
    let either = |upper: &str| env(upper).or_else(|| env(&upper.to_ascii_lowercase()));
    let no_proxy = either("NO_PROXY").unwrap_or_default();
    let host = endpoint.hostname.to_ascii_lowercase();
    let bypass = no_proxy.split(',').map(|item| item.trim().to_ascii_lowercase()).filter(|item| !item.is_empty()).any(|item| {
        let item = item.trim_start_matches("*.").trim_start_matches('.').to_string();
        item == "*" || host == item || host.ends_with(&format!(".{item}"))
    });
    if bypass { return Route::Direct; }
    let proxy = if endpoint.secure { either("HTTPS_PROXY") } else { either("HTTP_PROXY") }.or_else(|| either("ALL_PROXY"));
    match proxy {
        Some(value) => {
            let text = if value.contains("://") { value.clone() } else { format!("http://{value}") };
            let host = url::Url::parse(&text).ok().and_then(|url| url.host_str().map(|host| match url.port() { Some(port) => format!("{host}:{port}"), None => host.to_string() }));
            // A proxy address that does not read: reqwest ignores it too.
            host.map_or(Route::Direct, Route::Proxy)
        }
        None => Route::Direct,
    }
}

/// The proxy Windows itself is set to use (Settings › Network › Proxy), as `host:port`. This
/// build does not follow it (reqwest reads the environment only): the journal says so, because
/// « the browser reaches the server and the app does not » is then explained.
#[cfg(windows)]
pub fn windows_proxy() -> Option<String> {
    use windows::{core::w, Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD, RRF_RT_REG_SZ}};
    let key = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings");
    let mut enabled = 0u32;
    let mut size = 4u32;
    let read = unsafe { RegGetValueW(HKEY_CURRENT_USER, key, w!("ProxyEnable"), RRF_RT_REG_DWORD, None, Some((&mut enabled as *mut u32).cast()), Some(&mut size)) };
    if read.is_err() || enabled == 0 { return None; }
    let mut buffer = [0u16; 512];
    let mut size = (buffer.len() * 2) as u32;
    let read = unsafe { RegGetValueW(HKEY_CURRENT_USER, key, w!("ProxyServer"), RRF_RT_REG_SZ, None, Some(buffer.as_mut_ptr().cast()), Some(&mut size)) };
    if read.is_err() { return None; }
    let length = buffer.iter().position(|c| *c == 0).unwrap_or(buffer.len());
    windows_proxy_host(&String::from_utf16_lossy(&buffer[..length]))
}
#[cfg(not(windows))]
pub fn windows_proxy() -> Option<String> { None }
/// `ProxyServer` is `host:port`, or `http=host:port;https=host:port`: the https one, else the first.
fn windows_proxy_host(value: &str) -> Option<String> {
    let parts: Vec<&str> = value.split(';').map(str::trim).filter(|part| !part.is_empty()).collect();
    let chosen = parts.iter().find_map(|part| part.strip_prefix("https=")).or_else(|| parts.first().map(|part| part.split_once('=').map_or(*part, |(_, host)| host)))?;
    let host = chosen.trim().trim_start_matches("http://").trim_start_matches("https://").trim_end_matches('/');
    (!host.is_empty() && host.len() <= 120 && !host.contains(char::is_whitespace)).then(|| host.to_string())
}

/// The HTTP client of every request of the app: no redirect followed, and no proxy for a
/// direct route (a local server above all).
pub fn client(route: &Route, connect: Duration, total: Duration) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).connect_timeout(connect).timeout(total);
    if *route == Route::Direct { builder = builder.no_proxy(); }
    builder.build().map_err(|_| "Impossible de créer le client HTTP.".to_string())
}

/// What a check reports while it runs: the trace at each change, and one journal line per step
/// (the caller numbers it and answers its id).
pub struct Hooks<'a> {
    pub on_step: &'a (dyn Fn(&[ProbeStep]) + Send + Sync),
    pub log: &'a (dyn Fn(Diag) -> u64 + Send + Sync),
    /// Scrubs a system text of the keys (the journal's `redact`).
    pub redact: &'a (dyn Fn(&str) -> String + Send + Sync),
}

pub struct ProbeInput {
    pub run: String,
    pub endpoint: String,
    pub api_key: String,
    pub no_key: bool,
}
impl ProbeInput {
    /// The key that travels: none for « Mon serveur n'a pas de clé », whatever the field holds.
    fn key(&self) -> &str {
        if self.no_key { "" } else { self.api_key.trim() }
    }
}

const ORDER: [StepId; 4] = [StepId::Address, StepId::Reach, StepId::Key, StepId::Models];
pub fn initial_steps() -> Vec<ProbeStep> {
    ORDER.iter().map(|id| ProbeStep { id: *id, state: StepState::Waiting, ms: None, detail: None }).collect()
}

struct Trace<'a> {
    run: String,
    steps: Vec<ProbeStep>,
    hooks: &'a Hooks<'a>,
    started: Instant,
    endpoint: NormalizedEndpoint,
}
impl Trace<'_> {
    fn set(&mut self, id: StepId, state: StepState, ms: Option<u64>, detail: Option<StepDetail>) {
        if let Some(step) = self.steps.iter_mut().find(|step| step.id == id) {
            *step = ProbeStep { id, state, ms, detail };
        }
        (self.hooks.on_step)(&self.steps);
    }
    fn run(&mut self, id: StepId) { self.set(id, StepState::Running, None, None); }
    fn ok(&mut self, id: StepId, ms: u64, detail: StepDetail) { self.set(id, StepState::Ok, Some(ms), Some(detail)); }
    fn log(&self, diag: Diag) -> u64 { (self.hooks.log)(diag.run(&self.run)) }
    /// The failing row turns red, the rows after it are skipped, the journal gets the cause.
    fn fail(mut self, id: StepId, cause: ProbeCause, ms: Option<u64>, status: Option<u16>, technical: Option<String>, diag: Diag) -> ProbeResult {
        let index = self.steps.iter().position(|step| step.id == id).unwrap_or(0);
        for step in self.steps.iter_mut().skip(index + 1) { *step = ProbeStep { id: step.id, state: StepState::Skipped, ms: None, detail: None }; }
        // A row still running before the failing one never got its verdict.
        for step in self.steps.iter_mut().take(index) { if step.state == StepState::Running || step.state == StepState::Waiting { step.state = StepState::Skipped; } }
        self.set(id, StepState::Error, ms, None);
        let technical = technical.map(|text| (self.hooks.redact)(&text)).filter(|text| !text.is_empty());
        let mut diag = Diag { step: Some(id.diag()), level: Some(DiagLevel::Error), code: cause.code(), ms, status, ..diag };
        if let Some(text) = &technical { diag.cause = Some(text.clone()); }
        let log_id = self.log(diag);
        ProbeResult {
            run: self.run, ok: false, endpoint: self.endpoint, steps: self.steps, models: Vec::new(),
            problem: Some(ProbeProblem { step: id, cause, status, technical, log_id: Some(log_id) }),
            total_ms: self.started.elapsed().as_millis() as u64,
        }
    }
    /// A newer check, or the window closing, took over: nothing more is reported.
    fn cancelled(mut self) -> ProbeResult {
        let at = self.steps.iter().find(|step| step.state == StepState::Running).map_or(StepId::Address, |step| step.id);
        for step in self.steps.iter_mut() { if matches!(step.state, StepState::Running | StepState::Waiting) { step.state = StepState::Skipped; } }
        ProbeResult {
            run: self.run, ok: false, endpoint: self.endpoint, steps: self.steps, models: Vec::new(),
            problem: Some(ProbeProblem { step: at, cause: ProbeCause::Cancelled, status: None, technical: None, log_id: None }),
            total_ms: self.started.elapsed().as_millis() as u64,
        }
    }
}

fn elapsed_ms(since: Instant) -> u64 {
    since.elapsed().as_millis() as u64
}

/// The innermost message of an error chain: what the system said, without reqwest's wrapping
/// (which names the full URL).
pub fn technical(error: &(dyn std::error::Error + 'static)) -> String {
    let mut last = error.to_string();
    let mut next = error.source();
    while let Some(current) = next {
        let text = current.to_string();
        if !text.is_empty() { last = text; }
        next = current.source();
    }
    last
}

/// Model ids of an OpenAI `/v1/models` body (`{ data: [{ id, owned_by }] }`); None when it is
/// not one. Duplicates and empty ids are dropped, 500 models at most, ids of 200 characters at most.
pub fn parse_models(body: &Value) -> Option<Vec<ModelInfo>> {
    let data = body.get("data")?.as_array()?;
    let mut models: Vec<ModelInfo> = Vec::new();
    for item in data {
        let id = item.as_str().or_else(|| item.get("id").and_then(Value::as_str)).map(str::trim).unwrap_or_default();
        if id.is_empty() || id.chars().count() > 200 || id.chars().any(char::is_control) || models.iter().any(|known| known.id == id) { continue; }
        let owned_by = item.get("owned_by").and_then(Value::as_str).map(str::trim).filter(|owner| !owner.is_empty() && owner.chars().count() <= 80).map(str::to_string);
        models.push(ModelInfo { id: id.to_string(), owned_by });
        if models.len() >= 500 { break; }
    }
    Some(models)
}

/// What GET {base}/v1/models gave.
enum Listing {
    /// No answer: the cause, the system's words, the time spent, and whether the wait (not the
    /// connection) ran out.
    Transport { cause: ProbeCause, technical: String, ms: u64 },
    Status { status: u16, ms: u64 },
    /// A 2xx that is not a model list.
    Invalid { status: u16, header_ms: u64, body_ms: u64 },
    Models { models: Vec<ModelInfo>, header_ms: u64, body_ms: u64 },
    Cancelled,
}

const MAX_BODY: usize = 2 * 1024 * 1024;

/// How the reading of a response body ended.
enum Body {
    Read(Vec<u8>),
    /// Past `MAX_BODY`: the reading stopped there, the rest was never received.
    TooLarge,
    Failed(reqwest::Error),
    Cancelled,
}
/// A body counted as it arrives and never read past `MAX_BODY` (a server that streams without
/// end costs 2 MB, not the memory of the machine).
async fn bounded_body(response: reqwest::Response, cancel: &CancellationToken) -> Body {
    let mut body: Vec<u8> = Vec::new();
    let mut stream = response.bytes_stream();
    loop {
        let next = tokio::select! {
            _ = cancel.cancelled() => return Body::Cancelled,
            next = futures_util::StreamExt::next(&mut stream) => next,
        };
        match next {
            Some(Ok(chunk)) => {
                if body.len() + chunk.len() > MAX_BODY { return Body::TooLarge; }
                body.extend_from_slice(&chunk);
            }
            Some(Err(error)) => return Body::Failed(error),
            None => return Body::Read(body),
        }
    }
}

async fn fetch_models(endpoint: &Endpoint, key: &str, route: &Route, limits: Limits, cancel: &CancellationToken) -> Listing {
    let started = Instant::now();
    let url = format!("{}/v1/models", endpoint.base);
    let client = match client(route, limits.connect, limits.request) {
        Ok(client) => client,
        Err(message) => return Listing::Transport { cause: ProbeCause::ReachNetwork, technical: message, ms: 0 },
    };
    let mut request = client.get(&url);
    if !key.is_empty() { request = request.bearer_auth(key); }
    let transport = |error: reqwest::Error, started: Instant| {
        let error = error.without_url();
        // The connection opened and the answer never came: the wait ran out.
        let cause = if error.is_timeout() { ProbeCause::ReachTimeout } else { ProbeCause::of_transport(inference::cause(&error)) };
        Listing::Transport { cause, technical: technical(&error), ms: elapsed_ms(started) }
    };
    let response = tokio::select! {
        _ = cancel.cancelled() => return Listing::Cancelled,
        response = request.send() => match response { Ok(response) => response, Err(error) => return transport(error, started) },
    };
    let header_ms = elapsed_ms(started);
    let status = response.status().as_u16();
    if !response.status().is_success() { return Listing::Status { status, ms: header_ms }; }
    let body_started = Instant::now();
    // The body is read up to 2 MB and never kept: only the model ids leave this function.
    let body = match bounded_body(response, cancel).await {
        Body::Read(body) => body,
        Body::TooLarge => return Listing::Invalid { status, header_ms, body_ms: elapsed_ms(body_started) },
        Body::Failed(error) => return transport(error, started),
        Body::Cancelled => return Listing::Cancelled,
    };
    let body_ms = elapsed_ms(body_started);
    match serde_json::from_slice::<Value>(&body).ok().as_ref().and_then(parse_models) {
        Some(models) => Listing::Models { models, header_ms, body_ms },
        None => Listing::Invalid { status, header_ms, body_ms },
    }
}

/// TCP to one of the resolved addresses, within the connect limit.
async fn open(addresses: &[std::net::SocketAddr], limit: Duration) -> Result<tokio::net::TcpStream, (Cause, String)> {
    let deadline = Instant::now() + limit;
    let mut last = (Cause::Other, String::from("no address"));
    for address in addresses.iter().take(4) {
        let left = deadline.saturating_duration_since(Instant::now());
        if left.is_zero() { return Err((Cause::Silent, "connect timed out".into())); }
        match tokio::time::timeout(left, tokio::net::TcpStream::connect(address)).await {
            Ok(Ok(stream)) => return Ok(stream),
            Ok(Err(error)) => last = (inference::cause(&error), error.to_string()),
            Err(_) => last = (Cause::Silent, "connect timed out".into()),
        }
    }
    Err(last)
}

/// The TLS handshake Windows does (schannel, the client of 0.5.1): its certificate verdict.
async fn handshake(stream: tokio::net::TcpStream, host: String, limit: Duration) -> Result<(), (Cause, String)> {
    let stream = stream.into_std().map_err(|error| (Cause::Other, error.to_string()))?;
    let started = Instant::now();
    let work = tokio::task::spawn_blocking(move || -> Result<(), (Cause, String)> {
        stream.set_nonblocking(false).map_err(|error| (Cause::Other, error.to_string()))?;
        let _ = stream.set_read_timeout(Some(limit));
        let _ = stream.set_write_timeout(Some(limit));
        let connector = native_tls::TlsConnector::new().map_err(|error| (Cause::Tls, error.to_string()))?;
        match connector.connect(&host, stream) {
            Ok(_) => Ok(()),
            Err(native_tls::HandshakeError::Failure(error)) => {
                let text = error.to_string();
                Err((inference::tls_cause(&text), text))
            }
            Err(native_tls::HandshakeError::WouldBlock(_)) => Err((Cause::Silent, "handshake timed out".into())),
        }
    });
    match tokio::time::timeout(limit + Duration::from_millis(500), work).await {
        Ok(Ok(Ok(()))) => Ok(()),
        // The server accepted the connection and never spoke TLS back in time.
        Ok(Ok(Err((_, text)))) if started.elapsed() >= limit => Err((Cause::Silent, text)),
        Ok(Ok(Err(failure))) => Err(failure),
        Ok(Err(_)) => Err((Cause::Other, "handshake interrupted".into())),
        Err(_) => Err((Cause::Silent, "handshake timed out".into())),
    }
}

/// The check. Probes what is typed (`input`), not what is saved.
pub async fn probe(input: ProbeInput, limits: Limits, forced_route: Option<Route>, cancel: CancellationToken, hooks: &Hooks<'_>) -> ProbeResult {
    let key = input.key().to_string();
    let mut trace = Trace { run: input.run.clone(), steps: initial_steps(), hooks, started: Instant::now(), endpoint: NormalizedEndpoint::of(&input.endpoint) };
    (hooks.on_step)(&trace.steps);

    // 1. Address: it reads, then its name resolves.
    trace.run(StepId::Address);
    let endpoint = match normalize_endpoint(&input.endpoint) {
        Ok(endpoint) => endpoint,
        Err(reason) => return trace.fail(StepId::Address, ProbeCause::of_address(reason), Some(0), None, None, Diag::default()),
    };
    let route = forced_route.unwrap_or_else(|| route(&endpoint));
    let models_url = format!("{}/v1/models", endpoint.base);
    let found = if endpoint.local { StepDetail::Local { host: endpoint.host.clone() } } else { StepDetail::Found { host: endpoint.host.clone() } };
    let mut addresses: Vec<std::net::SocketAddr> = Vec::new();
    match &route {
        Route::Proxy(proxy) => {
            // The proxy resolves and connects: both rows are judged by the one request below.
            trace.ok(StepId::Address, 0, found);
            trace.log(Diag::new(DiagStep::Address, DiagLevel::Info, "proxy").detail(endpoint.host.clone()).proxy(Some(format!("system: {proxy}"))));
        }
        Route::Direct => {
            let started = Instant::now();
            let lookup = tokio::select! {
                _ = cancel.cancelled() => return trace.cancelled(),
                lookup = tokio::time::timeout(limits.resolve, tokio::net::lookup_host((endpoint.hostname.clone(), endpoint.port))) => lookup,
            };
            let ms = elapsed_ms(started);
            match lookup {
                Ok(Ok(found_addresses)) => addresses = found_addresses.collect(),
                Ok(Err(error)) => return trace.fail(StepId::Address, ProbeCause::AddressDns, Some(ms), None, Some(error.to_string()), Diag::default().detail(endpoint.host.clone())),
                Err(_) => return trace.fail(StepId::Address, ProbeCause::AddressDns, Some(ms), None, Some("dns lookup timed out".into()), Diag::default().detail(endpoint.host.clone())),
            }
            if addresses.is_empty() {
                return trace.fail(StepId::Address, ProbeCause::AddressDns, Some(ms), None, None, Diag::default().detail(endpoint.host.clone()));
            }
            trace.ok(StepId::Address, ms, found);
            let mut resolved = Diag::new(DiagStep::Address, DiagLevel::Ok, if endpoint.local { "local" } else { "resolved" }).ms(ms).detail(format!("{} → {}", endpoint.host, addresses[0].ip()));
            // Windows has a proxy this build does not follow: said once per check, for whoever reads.
            if !endpoint.local { if let Some(unused) = windows_proxy() { resolved = resolved.cause(format!("system proxy {unused} not used (direct connection)")); } }
            trace.log(resolved);
        }
    }

    // 2. Reach: TCP, then TLS for https. Through a proxy the request itself tells.
    trace.run(StepId::Reach);
    let reached = if endpoint.secure { StepDetail::Tls } else if endpoint.local { StepDetail::HttpLocal } else { StepDetail::HttpInsecure };
    let reach_code = if endpoint.secure { "tls" } else { "connected" };
    let reach_started = Instant::now();
    if route == Route::Direct {
        let opened = tokio::select! {
            _ = cancel.cancelled() => return trace.cancelled(),
            opened = open(&addresses, limits.connect) => opened,
        };
        let secured = match opened {
            Ok(stream) if endpoint.secure => {
                let left = limits.connect.saturating_sub(reach_started.elapsed()).max(Duration::from_millis(250));
                tokio::select! {
                    _ = cancel.cancelled() => return trace.cancelled(),
                    secured = handshake(stream, endpoint.hostname.clone(), left) => secured,
                }
            }
            Ok(_) => Ok(()),
            Err(failure) => Err(failure),
        };
        let ms = elapsed_ms(reach_started);
        if let Err((cause, text)) = secured {
            return trace.fail(StepId::Reach, ProbeCause::of_transport(cause), Some(ms), None, Some(text), Diag::default().detail(endpoint.host.clone()));
        }
        trace.ok(StepId::Reach, ms, reached.clone());
        trace.log(Diag::new(DiagStep::Reach, DiagLevel::Ok, reach_code).ms(ms).detail(endpoint.host.clone()));
        trace.run(StepId::Key);
    }

    // 3 and 4. One GET {base}/v1/models: the key's verdict, then the list.
    let listing = fetch_models(&endpoint, &key, &route, limits, &cancel).await;
    let request = |diag: Diag| diag.request("GET", &models_url).key(&key).proxy(route.label());
    let via_proxy = route != Route::Direct;
    match listing {
        Listing::Cancelled => trace.cancelled(),
        Listing::Transport { cause, technical, ms } => {
            // No answer is the connection's row, even when the connection itself had opened:
            // the key was never judged.
            let step = if cause == ProbeCause::AddressDns { StepId::Address } else { StepId::Reach };
            trace.fail(step, cause, Some(ms), None, Some(technical), request(Diag::default()))
        }
        Listing::Status { status, ms } => {
            if via_proxy { trace.ok(StepId::Reach, ms, reached); }
            let diag = request(Diag::default());
            match status {
                401 | 403 => trace.fail(StepId::Key, if key.is_empty() { ProbeCause::KeyRequired } else { ProbeCause::KeyRejected }, Some(ms), Some(status), None, diag),
                // The address answers, but not as an OpenAI API (a redirect is a web page's).
                300..=399 | 404 | 405 => trace.fail(StepId::Models, ProbeCause::ModelsNotFound, Some(ms), Some(status), None, diag),
                500..=599 => trace.fail(StepId::Models, ProbeCause::ModelsServer, Some(ms), Some(status), None, diag),
                _ => trace.fail(StepId::Models, ProbeCause::ModelsInvalid, Some(ms), Some(status), None, diag),
            }
        }
        Listing::Invalid { status, header_ms, body_ms } => {
            if via_proxy { trace.ok(StepId::Reach, header_ms, reached); }
            trace.ok(StepId::Key, header_ms, key_detail(&key, input.no_key));
            trace.fail(StepId::Models, ProbeCause::ModelsInvalid, Some(body_ms), Some(status), None, request(Diag::default()))
        }
        Listing::Models { models, header_ms, body_ms } => {
            if via_proxy { trace.ok(StepId::Reach, header_ms, reached); }
            trace.ok(StepId::Key, header_ms, key_detail(&key, input.no_key));
            trace.log(Diag::new(DiagStep::Key, DiagLevel::Ok, if key.is_empty() { "key_none" } else { "key_accepted" }).ms(header_ms).key(&key));
            trace.run(StepId::Models);
            if models.is_empty() {
                return trace.fail(StepId::Models, ProbeCause::ModelsEmpty, Some(body_ms), Some(200), None, request(Diag::default()));
            }
            trace.ok(StepId::Models, body_ms, StepDetail::Models { count: models.len() });
            trace.log(request(Diag::new(DiagStep::Models, DiagLevel::Ok, "models")).status(200).ms(header_ms + body_ms).detail(models.len().to_string()));
            ProbeResult { run: trace.run, ok: true, endpoint: trace.endpoint, steps: trace.steps, models, problem: None, total_ms: elapsed_ms(trace.started) }
        }
    }
}

fn key_detail(key: &str, no_key: bool) -> StepDetail {
    if !key.is_empty() { StepDetail::KeyAccepted { tail: key_tail(key) } } else if no_key { StepDetail::KeyNone } else { StepDetail::KeyNotAsked }
}

/// The only text « Essayer avec une phrase » ever sends: fixed and synthetic, never the person's.
pub const TRY_SENTENCE: &str = "Translate into French, reply with the translation only: \"Good morning, the meeting starts at ten.\"";
const TRY_REPLY_CHARS: usize = 200;

/// The reply of a chat completion: its text without a leading thinking block, 200 characters at most.
pub fn parse_reply(body: &Value) -> Option<String> {
    let choice = body.get("choices")?.get(0)?;
    let content = choice.pointer("/message/content").and_then(Value::as_str).or_else(|| choice.get("text").and_then(Value::as_str))?;
    let mut filter = inference::ThinkFilter::default();
    let mut shown = filter.push(content);
    shown.push_str(&filter.finish());
    let clean = inference::clean_output(&shown);
    if clean.is_empty() { return None; }
    Some(if clean.chars().count() > TRY_REPLY_CHARS { clean.chars().take(TRY_REPLY_CHARS - 1).chain(Some('…')).collect() } else { clean })
}

pub struct TryInput {
    pub run: String,
    pub endpoint: String,
    pub api_key: String,
    pub no_key: bool,
    pub model: String,
}

/// « Essayer avec une phrase »: one short, non-streamed completion of the fixed sentence.
pub async fn try_model(input: TryInput, limits: Limits, cancel: CancellationToken, hooks: &Hooks<'_>) -> TryResult {
    let key = if input.no_key { String::new() } else { input.api_key.trim().to_string() };
    let model = input.model.trim().to_string();
    let run = input.run.clone();
    let failed = |cause: ProbeCause, status: Option<u16>, technical: Option<String>, ms: Option<u64>, url: Option<&str>| -> TryResult {
        let technical = technical.map(|text| (hooks.redact)(&text)).filter(|text| !text.is_empty());
        let mut diag = Diag::new(DiagStep::Try, DiagLevel::Error, cause.code()).run(&run).key(&key).detail(model.clone());
        if let Some(url) = url { diag = diag.request("POST", url); }
        diag.status = status;
        diag.ms = ms;
        diag.cause = technical.clone();
        let log_id = if cause == ProbeCause::Cancelled { None } else { Some((hooks.log)(diag)) };
        TryResult { run: run.clone(), ok: false, reply: None, ms: None, problem: Some(ProbeProblem { step: StepId::Try, cause, status, technical, log_id }) }
    };
    let endpoint = match normalize_endpoint(&input.endpoint) {
        Ok(endpoint) => endpoint,
        Err(reason) => return failed(ProbeCause::of_address(reason), None, None, None, None),
    };
    if model.is_empty() || model.chars().count() > 200 || model.chars().any(char::is_control) {
        return failed(ProbeCause::TryModel, None, None, None, None);
    }
    let url = format!("{}/v1/chat/completions", endpoint.base);
    let route = route(&endpoint);
    let client = match client(&route, limits.connect, limits.attempt) {
        Ok(client) => client,
        Err(message) => return failed(ProbeCause::ReachNetwork, None, Some(message), None, Some(&url)),
    };
    // A model that thinks by default (Gemma 4, Qwen3) spends the 60 tokens of the trial on its
    // reasoning and answers nothing: the trial asks for a direct answer, as a generation does
    // (`inference::request_body`), and asks once more without the switch when a strict
    // endpoint names it in its refusal.
    let mut thinking_switch = true;
    let (response, started, status) = loop {
        let mut body = json!({ "model": model, "messages": [{ "role": "user", "content": TRY_SENTENCE }], "max_tokens": 60, "temperature": 0, "stream": false });
        if thinking_switch { body["chat_template_kwargs"] = json!({ "enable_thinking": false }); }
        let mut request = client.post(&url).json(&body);
        if !key.is_empty() { request = request.bearer_auth(&key); }
        let started = Instant::now();
        let response = tokio::select! {
            _ = cancel.cancelled() => return failed(ProbeCause::Cancelled, None, None, None, None),
            response = request.send() => response,
        };
        let response = match response {
            Ok(response) => response,
            Err(error) => {
                let error = error.without_url();
                // Connected, then silence: the model is too slow (or still loading), not the network.
                let cause = if error.is_timeout() && !error.is_connect() { ProbeCause::TryTimeout } else if error.is_timeout() { ProbeCause::ReachTimeout } else { ProbeCause::of_transport(inference::cause(&error)) };
                return failed(cause, None, Some(technical(&error)), Some(elapsed_ms(started)), Some(&url));
            }
        };
        let status = response.status().as_u16();
        if !response.status().is_success() {
            let ms = elapsed_ms(started);
            if thinking_switch && (400..500).contains(&status) && !matches!(status, 401 | 403 | 404) {
                let refusal = match bounded_body(response, &cancel).await {
                    Body::Cancelled => return failed(ProbeCause::Cancelled, None, None, None, None),
                    Body::Read(refusal) => String::from_utf8_lossy(&refusal).into_owned(),
                    Body::TooLarge | Body::Failed(_) => String::new(),
                };
                if refusal.contains("chat_template_kwargs") { thinking_switch = false; continue; }
            }
            let cause = match status {
                401 | 403 => if key.is_empty() { ProbeCause::KeyRequired } else { ProbeCause::KeyRejected },
                404 => ProbeCause::TryModel,
                500..=599 => ProbeCause::TryServer,
                _ => ProbeCause::TryRejected,
            };
            return failed(cause, Some(status), None, Some(ms), Some(&url));
        }
        break (response, started, status);
    };
    let body = bounded_body(response, &cancel).await;
    let ms = elapsed_ms(started);
    let body = match body {
        Body::Read(body) => body,
        Body::Cancelled => return failed(ProbeCause::Cancelled, None, None, None, None),
        Body::TooLarge => return failed(ProbeCause::TryEmpty, Some(status), None, Some(ms), Some(&url)),
        Body::Failed(error) => {
            let error = error.without_url();
            return failed(if error.is_timeout() { ProbeCause::TryTimeout } else { ProbeCause::ReachNetwork }, Some(status), Some(technical(&error)), Some(ms), Some(&url));
        }
    };
    match serde_json::from_slice::<Value>(&body).ok().as_ref().and_then(parse_reply) {
        Some(reply) => {
            // The reply itself goes to the interface only: the journal keeps its length.
            (hooks.log)(Diag::new(DiagStep::Try, DiagLevel::Ok, "reply").run(&run).request("POST", &url).status(status).ms(ms).key(&key).proxy(route.label()).detail(format!("{model} · {} chars", reply.chars().count())));
            TryResult { run, ok: true, reply: Some(reply), ms: Some(ms), problem: None }
        }
        None => failed(ProbeCause::TryEmpty, Some(status), None, Some(ms), Some(&url)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::{DiagEntry, Diagnostics};
    use std::sync::{Arc, Mutex};

    // Fake OpenAI servers on 127.0.0.1 only, on ports of our own; nothing real is contacted.
    // `answer(path, authorization)` gives the raw response; None keeps the connection open
    // without answering (a server that stopped).
    fn serve(answer: impl Fn(&str, Option<&str>) -> Option<Vec<u8>> + Send + Sync + 'static) -> String {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let answer = Arc::new(answer);
        std::thread::spawn(move || {
            for connection in listener.incoming() {
                let Ok(mut connection) = connection else { break };
                let answer = answer.clone();
                std::thread::spawn(move || {
                    let mut head = Vec::new();
                    let mut byte = [0u8; 1];
                    while !head.ends_with(b"\r\n\r\n") && connection.read(&mut byte).is_ok_and(|n| n == 1) { head.push(byte[0]); }
                    let head = String::from_utf8_lossy(&head).to_string();
                    if head.is_empty() { return; }
                    let length = head.lines().find_map(|line| line.to_ascii_lowercase().strip_prefix("content-length:").map(|v| v.trim().parse::<usize>().unwrap_or(0))).unwrap_or(0);
                    let mut body = vec![0u8; length];
                    let _ = connection.read_exact(&mut body);
                    let path = head.split_whitespace().nth(1).unwrap_or_default().to_string();
                    let authorization = head.lines().find_map(|line| line.strip_prefix("authorization: ").or_else(|| line.strip_prefix("Authorization: "))).map(str::to_string);
                    match answer(&path, authorization.as_deref()) {
                        Some(bytes) => { let _ = connection.write_all(&bytes); let _ = connection.flush(); }
                        None => std::thread::sleep(Duration::from_secs(4)),
                    }
                });
            }
        });
        format!("http://127.0.0.1:{port}")
    }
    fn status(code: u16, body: &str) -> Vec<u8> {
        format!("HTTP/1.1 {code} Status\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).into_bytes()
    }
    const MODELS: &str = r#"{"object":"list","data":[{"id":"gemma-4-12b","owned_by":"llama.cpp"},{"id":"qwen3-8b"},{"id":"gemma-4-12b"},{"id":""}]}"#;
    const KEY: &str = "sk-synthetic-0123456789-3f2a";
    fn short() -> Limits {
        Limits { resolve: Duration::from_secs(3), connect: Duration::from_secs(3), request: Duration::from_millis(700), attempt: Duration::from_millis(700) }
    }

    struct Recorder { journal: Diagnostics, traces: Mutex<Vec<Vec<ProbeStep>>> }
    impl Recorder {
        fn new() -> Self { Self { journal: Diagnostics::new(None), traces: Mutex::new(Vec::new()) } }
        async fn probe_with(&self, endpoint: &str, key: &str, no_key: bool, limits: Limits, route: Option<Route>, cancel: CancellationToken) -> ProbeResult {
            self.journal.remember_secret(key);
            let on_step = |steps: &[ProbeStep]| self.traces.lock().unwrap().push(steps.to_vec());
            let log = |diag: Diag| self.journal.add(diag).id;
            let redact = |text: &str| self.journal.redact(text);
            let hooks = Hooks { on_step: &on_step, log: &log, redact: &redact };
            probe(ProbeInput { run: "run-1".into(), endpoint: endpoint.into(), api_key: key.into(), no_key }, limits, route, cancel, &hooks).await
        }
        async fn probe(&self, endpoint: &str, key: &str) -> ProbeResult {
            self.probe_with(endpoint, key, false, short(), Some(Route::Direct), CancellationToken::new()).await
        }
        async fn attempt(&self, endpoint: &str, key: &str, model: &str) -> TryResult {
            self.journal.remember_secret(key);
            let on_step = |_: &[ProbeStep]| {};
            let log = |diag: Diag| self.journal.add(diag).id;
            let redact = |text: &str| self.journal.redact(text);
            let hooks = Hooks { on_step: &on_step, log: &log, redact: &redact };
            try_model(TryInput { run: "try-1".into(), endpoint: endpoint.into(), api_key: key.into(), no_key: false, model: model.into() }, short(), CancellationToken::new(), &hooks).await
        }
        fn entries(&self) -> Vec<DiagEntry> { self.journal.list() }
    }
    fn states(result: &ProbeResult) -> Vec<StepState> { result.steps.iter().map(|step| step.state).collect() }
    fn cause(result: &ProbeResult) -> (StepId, ProbeCause, Option<u16>) {
        let problem = result.problem.as_ref().expect("a problem");
        (problem.step, problem.cause, problem.status)
    }
    use StepState::{Error, Ok as Done, Skipped};

    #[tokio::test]
    async fn a_server_that_answers_gives_its_models_step_by_step() {
        let seen = Arc::new(Mutex::new(Vec::<(String, Option<String>)>::new()));
        let log = seen.clone();
        let server = serve(move |path, authorization| {
            log.lock().unwrap().push((path.to_string(), authorization.map(str::to_string)));
            Some(status(200, MODELS))
        });
        let recorder = Recorder::new();
        // Typed with its /v1 and a final slash: probed as typed, cleaned on the way.
        let result = recorder.probe(&format!("{server}/v1/"), KEY).await;
        assert!(result.ok, "{:?}", result.problem);
        assert_eq!(states(&result), [Done, Done, Done, Done]);
        assert_eq!(result.models, vec![ModelInfo { id: "gemma-4-12b".into(), owned_by: Some("llama.cpp".into()) }, ModelInfo { id: "qwen3-8b".into(), owned_by: None }], "no duplicate, no empty id");
        let details: Vec<_> = result.steps.iter().map(|step| step.detail.clone().unwrap()).collect();
        assert_eq!(details[0], StepDetail::Local { host: server.trim_start_matches("http://").to_string() });
        assert_eq!(details[1], StepDetail::HttpLocal);
        assert_eq!(details[2], StepDetail::KeyAccepted { tail: "3f2a".into() });
        assert_eq!(details[3], StepDetail::Models { count: 2 });
        assert!(result.steps.iter().all(|step| step.ms.is_some()));
        assert!(matches!(&result.endpoint, NormalizedEndpoint::Valid { ok: true, endpoint } if endpoint.base == server && endpoint.removed.as_deref() == Some("/v1")));
        // One request, on /v1/models once, with the key.
        assert_eq!(*seen.lock().unwrap(), vec![("/v1/models".to_string(), Some(format!("Bearer {KEY}")))]);
        // The trace: everything waits, then each row runs before it is judged, never backwards.
        let traces = recorder.traces.lock().unwrap().clone();
        assert!(traces[0].iter().all(|step| step.state == StepState::Waiting));
        for (index, id) in ORDER.iter().enumerate() {
            let running = traces.iter().position(|steps| steps[index].state == StepState::Running).unwrap_or_else(|| panic!("{id:?} ran"));
            let done = traces.iter().position(|steps| steps[index].state == Done).unwrap();
            assert!(running < done, "{id:?}");
        }
        assert_eq!(traces.last().unwrap(), &result.steps);
        // The journal: one line per step, the run id, the masked key, never the key nor a body.
        let entries = recorder.entries();
        assert_eq!(entries.iter().map(|entry| entry.code.as_str()).collect::<Vec<_>>(), ["local", "connected", "key_accepted", "models"]);
        assert!(entries.iter().all(|entry| entry.run.as_deref() == Some("run-1")));
        let last = entries.last().unwrap();
        assert_eq!((last.method.as_deref(), last.url.as_deref(), last.status, last.key.as_deref()), (Some("GET"), Some(format!("{server}/v1/models").as_str()), Some(200), Some("••••3f2a")));
        let text = serde_json::to_string(&entries).unwrap();
        assert!(!text.contains(KEY) && !text.contains("llama.cpp") && !text.contains("gemma"), "{text}");
        // The serialised result, as the interface reads it.
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["steps"][2], serde_json::json!({ "id": "key", "state": "ok", "ms": result.steps[2].ms, "detail": { "code": "key_accepted", "tail": "3f2a" } }));
        assert_eq!(json["endpoint"]["ok"], true);
        assert_eq!(json["models"][0], serde_json::json!({ "id": "gemma-4-12b", "ownedBy": "llama.cpp" }));
        assert!(json.get("problem").is_none() && json["totalMs"].is_u64());
    }

    #[tokio::test]
    async fn a_key_asked_or_refused_stops_at_the_key_and_says_which() {
        let server = serve(|_, authorization| Some(if authorization == Some("Bearer good-key-0123456789") { status(200, MODELS) } else { status(401, r#"{"error":{"message":"Invalid API key SECRET-BODY"}}"#) }));
        let recorder = Recorder::new();
        let none = recorder.probe(&server, "").await;
        assert_eq!((states(&none), cause(&none)), (vec![Done, Done, Error, Skipped], (StepId::Key, ProbeCause::KeyRequired, Some(401))));
        let wrong = recorder.probe(&server, KEY).await;
        assert_eq!(cause(&wrong), (StepId::Key, ProbeCause::KeyRejected, Some(401)));
        // « Mon serveur n'a pas de clé »: the key left in the field does not travel.
        let unsent = recorder.probe_with(&server, "good-key-0123456789", true, short(), Some(Route::Direct), CancellationToken::new()).await;
        assert_eq!(cause(&unsent).1, ProbeCause::KeyRequired);
        let good = recorder.probe(&server, "  good-key-0123456789  ").await;
        assert!(good.ok);
        let forbidden = recorder.probe(&serve(|_, _| Some(status(403, "{}"))), KEY).await;
        assert_eq!(cause(&forbidden), (StepId::Key, ProbeCause::KeyRejected, Some(403)));
        // The failure opens the journal on its line; the server's words go nowhere.
        let entries = recorder.entries();
        let line = entries.iter().find(|entry| Some(entry.id) == wrong.problem.as_ref().unwrap().log_id).unwrap();
        assert_eq!((line.code.as_str(), line.status, line.key.as_deref()), ("key.rejected", Some(401), Some("••••3f2a")));
        let everything = format!("{}{}", serde_json::to_string(&entries).unwrap(), serde_json::to_string(&[&none, &wrong, &unsent, &forbidden]).unwrap());
        assert!(!everything.contains("SECRET-BODY") && !everything.contains(KEY) && !everything.contains("good-key"));
    }

    #[tokio::test]
    async fn an_address_that_answers_without_an_openai_api_fails_at_the_models() {
        let recorder = Recorder::new();
        for (answer, expected, code) in [
            (status(404, "<html>404 Not Found</html>"), ProbeCause::ModelsNotFound, 404),
            (status(405, ""), ProbeCause::ModelsNotFound, 405),
            (b"HTTP/1.1 301 Moved\r\nLocation: http://127.0.0.1:1/elsewhere\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_vec(), ProbeCause::ModelsNotFound, 301),
            (status(500, "{}"), ProbeCause::ModelsServer, 500),
            (status(503, "{}"), ProbeCause::ModelsServer, 503),
            (status(400, "{}"), ProbeCause::ModelsInvalid, 400),
        ] {
            let result = recorder.probe(&serve(move |_, _| Some(answer.clone())), "").await;
            assert_eq!(cause(&result), (StepId::Models, expected, Some(code)));
            assert_eq!(states(&result), [Done, Done, Skipped, Error], "{code}: the key was never judged");
        }
        // 200 with something else than a model list, then an empty list.
        for body in ["<html>ok</html>", "{\"models\":[]}", "[]", ""] {
            let body = body.to_string();
            let result = recorder.probe(&serve(move |_, _| Some(status(200, &body))), "").await;
            assert_eq!(cause(&result), (StepId::Models, ProbeCause::ModelsInvalid, Some(200)));
            assert_eq!(states(&result), [Done, Done, Done, Error]);
        }
        let empty = recorder.probe(&serve(|_, _| Some(status(200, r#"{"object":"list","data":[]}"#))), "").await;
        assert_eq!(cause(&empty), (StepId::Models, ProbeCause::ModelsEmpty, Some(200)));
        assert_eq!(empty.steps[2].detail, Some(StepDetail::KeyNotAsked));
        assert!(empty.models.is_empty() && !empty.ok);
    }

    #[tokio::test]
    async fn nothing_at_the_address_fails_at_the_connection_with_its_cause() {
        let recorder = Recorder::new();
        // Nothing listens: a port taken then released.
        let closed = { let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap(); listener.local_addr().unwrap().port() };
        let refused = recorder.probe(&format!("http://127.0.0.1:{closed}"), KEY).await;
        assert_eq!((states(&refused), cause(&refused)), (vec![Done, Error, Skipped, Skipped], (StepId::Reach, ProbeCause::ReachRefused, None)));
        assert!(refused.problem.as_ref().unwrap().technical.as_deref().is_some_and(|text| !text.is_empty() && !text.contains("http://")), "the system's words, no URL");
        // A name that never resolves (.invalid is reserved for that).
        let unknown = recorder.probe("https://flowtranslate-test.invalid/v1", KEY).await;
        assert_eq!((states(&unknown), cause(&unknown)), (vec![Error, Skipped, Skipped, Skipped], (StepId::Address, ProbeCause::AddressDns, None)));
        // HTTPS to a server that answers plain HTTP at once: the handshake fails.
        let plain = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = plain.local_addr().unwrap().port();
        std::thread::spawn(move || {
            use std::io::Write;
            for connection in plain.incoming() {
                let Ok(mut connection) = connection else { break };
                let _ = connection.write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
            }
        });
        let tls = recorder.probe(&format!("https://127.0.0.1:{port}"), KEY).await;
        assert_eq!((states(&tls), cause(&tls)), (vec![Done, Error, Skipped, Skipped], (StepId::Reach, ProbeCause::ReachTls, None)));
        // The connection opens and the server never answers: the wait runs out, on the connection's row.
        let silent = recorder.probe(&serve(|_, _| None), KEY).await;
        assert_eq!((states(&silent), cause(&silent)), (vec![Done, Error, Skipped, Skipped], (StepId::Reach, ProbeCause::ReachTimeout, None)));
        assert!(silent.steps[1].ms.is_some_and(|ms| (600..3_000).contains(&ms)), "{:?}", silent.steps[1].ms);
        // Every failure has its journal line, with the cause and never the key.
        let entries = recorder.entries();
        for result in [&refused, &unknown, &tls, &silent] {
            let problem = result.problem.as_ref().unwrap();
            let line = entries.iter().find(|entry| Some(entry.id) == problem.log_id).expect("a journal line");
            assert_eq!(line.code, problem.cause.code());
            assert_eq!(line.cause, problem.technical);
        }
        assert!(!serde_json::to_string(&entries).unwrap().contains(KEY));
    }

    #[tokio::test]
    async fn an_address_that_does_not_read_fails_before_any_network() {
        let recorder = Recorder::new();
        for (input, expected) in [("", ProbeCause::AddressEmpty), ("   ", ProbeCause::AddressEmpty), ("https://", ProbeCause::AddressMalformed), ("ftp://llm.exemple.com", ProbeCause::AddressScheme), ("https://user:pw@llm.exemple.com", ProbeCause::AddressCredentials)] {
            let result = recorder.probe(input, KEY).await;
            assert_eq!((states(&result), cause(&result)), (vec![Error, Skipped, Skipped, Skipped], (StepId::Address, expected, None)), "{input:?}");
            assert!(matches!(result.endpoint, NormalizedEndpoint::Invalid { ok: false, .. }));
        }
        let json = serde_json::to_value(recorder.probe("ftp://x", "").await).unwrap();
        assert_eq!(json["endpoint"], serde_json::json!({ "ok": false, "reason": "scheme" }));
        assert_eq!(json["problem"]["cause"], "address.scheme");
        assert_eq!(json["problem"]["step"], "address");
    }

    #[tokio::test]
    async fn a_cancelled_check_stops_at_once_and_reports_nothing_more() {
        let recorder = Recorder::new();
        let cancel = CancellationToken::new();
        let trigger = cancel.clone();
        tokio::spawn(async move { tokio::time::sleep(Duration::from_millis(150)).await; trigger.cancel(); });
        let started = Instant::now();
        let limits = Limits { request: Duration::from_secs(3), ..short() };
        let result = recorder.probe_with(&serve(|_, _| None), KEY, false, limits, Some(Route::Direct), cancel).await;
        assert!(started.elapsed() < Duration::from_millis(1_500), "{:?}", started.elapsed());
        assert_eq!(result.problem.as_ref().map(|problem| (problem.cause, problem.log_id)), Some((ProbeCause::Cancelled, None)));
        assert!(result.steps.iter().all(|step| !matches!(step.state, StepState::Running | StepState::Waiting)), "nothing left spinning");
        // Cancelled before it started: nothing touches the network.
        let cancel = CancellationToken::new();
        cancel.cancel();
        let result = recorder.probe_with("https://flowtranslate-test.invalid", KEY, false, short(), Some(Route::Direct), cancel).await;
        assert_eq!(result.problem.unwrap().cause, ProbeCause::Cancelled);
    }

    #[tokio::test]
    async fn through_a_proxy_the_request_itself_judges_the_address_and_the_connection() {
        // The « proxy » is forced as the route: no direct name resolution, no direct socket. The
        // request then leaves as reqwest decides (no proxy in the test environment), and its
        // outcome fills the rows.
        let recorder = Recorder::new();
        let server = serve(|_, _| Some(status(200, MODELS)));
        let proxied = Some(Route::Proxy("proxy.exemple.com:3128".into()));
        let result = recorder.probe_with(&server, "", true, short(), proxied.clone(), CancellationToken::new()).await;
        assert!(result.ok);
        assert_eq!(result.steps[2].detail, Some(StepDetail::KeyNone));
        let entries = recorder.entries();
        assert_eq!(entries[0].proxy.as_deref(), Some("system: proxy.exemple.com:3128"));
        assert_eq!(entries.last().unwrap().proxy.as_deref(), Some("system: proxy.exemple.com:3128"));
        let closed = { let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap(); listener.local_addr().unwrap().port() };
        // Windows takes about 2 s to say that nothing listens.
        let patient = Limits { request: Duration::from_secs(6), ..short() };
        let refused = recorder.probe_with(&format!("http://127.0.0.1:{closed}"), "", false, patient, proxied, CancellationToken::new()).await;
        assert_eq!((states(&refused), cause(&refused).1), (vec![Done, Error, Skipped, Skipped], ProbeCause::ReachRefused));
    }

    #[test]
    fn the_route_follows_the_environment_and_never_proxies_this_computer() {
        let env = |pairs: &'static [(&'static str, &'static str)]| move |name: &str| pairs.iter().find(|(key, _)| *key == name).map(|(_, value)| value.to_string());
        let remote = normalize_endpoint("https://llm.exemple.com").unwrap();
        let plain = normalize_endpoint("http://llm.exemple.com").unwrap();
        let local = normalize_endpoint("http://127.0.0.1:8002").unwrap();
        assert_eq!(route_from(&remote, env(&[])), Route::Direct);
        assert_eq!(route_from(&remote, env(&[("HTTPS_PROXY", "http://proxy.corp:3128")])), Route::Proxy("proxy.corp:3128".into()));
        assert_eq!(route_from(&remote, env(&[("https_proxy", "proxy.corp:8080")])), Route::Proxy("proxy.corp:8080".into()));
        assert_eq!(route_from(&remote, env(&[("HTTP_PROXY", "http://proxy.corp:3128")])), Route::Direct, "the http proxy is not the https one");
        assert_eq!(route_from(&plain, env(&[("HTTP_PROXY", "http://proxy.corp:3128")])), Route::Proxy("proxy.corp:3128".into()));
        assert_eq!(route_from(&remote, env(&[("ALL_PROXY", "socks5://proxy.corp:1080")])), Route::Proxy("proxy.corp:1080".into()));
        assert_eq!(route_from(&local, env(&[("HTTP_PROXY", "http://proxy.corp:3128"), ("ALL_PROXY", "http://proxy.corp:3128")])), Route::Direct);
        for no_proxy in ["*", "llm.exemple.com", ".exemple.com", "autre.test, exemple.com", "*.exemple.com"] {
            let direct = route_from(&remote, move |name: &str| match name { "HTTPS_PROXY" => Some("http://proxy.corp:3128".into()), "NO_PROXY" => Some(no_proxy.to_string()), _ => None });
            assert_eq!(direct, Route::Direct, "{no_proxy}");
        }
        assert_eq!(Route::Proxy("p:1".into()).label().as_deref(), Some("system: p:1"));
        assert_eq!(Route::Direct.label(), None);
        // Windows' own proxy setting, as the registry writes it.
        assert_eq!(windows_proxy_host("proxy.corp:3128").as_deref(), Some("proxy.corp:3128"));
        assert_eq!(windows_proxy_host("http=web.corp:80;https=secure.corp:443;ftp=f:21").as_deref(), Some("secure.corp:443"));
        assert_eq!(windows_proxy_host("http=web.corp:80").as_deref(), Some("web.corp:80"));
        assert_eq!(windows_proxy_host("  "), None);
    }

    #[tokio::test]
    async fn a_reply_larger_than_two_megabytes_is_never_read_whole() {
        let recorder = Recorder::new();
        let big = format!(r#"{{"choices":[{{"message":{{"content":"{}"}}}}]}}"#, "a".repeat(MAX_BODY + 4096));
        let server = serve(move |_, _| Some(status(200, &big)));
        let done = recorder.attempt(&server, KEY, "gemma-4-12b").await;
        assert_eq!(done.problem.map(|problem| problem.cause), Some(ProbeCause::TryEmpty));
        // The same body as a refusal: read up to the cap, then the refusal stands as it is.
        let refusal = "x".repeat(MAX_BODY + 4096);
        let server = serve(move |_, _| Some(status(400, &refusal)));
        let done = recorder.attempt(&server, KEY, "gemma-4-12b").await;
        assert_eq!(done.problem.map(|problem| (problem.cause, problem.status)), Some((ProbeCause::TryRejected, Some(400))));
    }

    #[tokio::test]
    async fn trying_a_model_sends_the_fixed_sentence_and_never_logs_the_reply() {
        let bodies = Arc::new(Mutex::new(Vec::<String>::new()));
        let recorder = Recorder::new();
        let reply = |content: &str| status(200, &serde_json::json!({ "choices": [{ "index": 0, "message": { "role": "assistant", "content": content }, "finish_reason": "stop" }] }).to_string());
        let server = serve(move |path, _| Some(match path {
            "/v1/chat/completions" => reply("<think>hmm</think>\nBonjour, la réunion commence à dix heures."),
            _ => status(404, "{}"),
        }));
        let _ = bodies;
        let done = recorder.attempt(&format!("{server}/v1"), KEY, " gemma-4-12b ").await;
        assert_eq!((done.ok, done.reply.as_deref()), (true, Some("Bonjour, la réunion commence à dix heures.")));
        assert!(done.ms.is_some() && done.problem.is_none());
        let entries = recorder.entries();
        let line = entries.last().unwrap();
        assert_eq!((line.code.as_str(), line.method.as_deref(), line.status), ("reply", Some("POST"), Some(200)));
        let text = serde_json::to_string(&entries).unwrap();
        assert!(!text.contains("réunion") && !text.contains("Good morning") && !text.contains(KEY), "{text}");
        // What can go wrong, each with its cause.
        let cause_of = |result: TryResult| result.problem.map(|problem| (problem.cause, problem.status));
        assert_eq!(cause_of(recorder.attempt(&serve(|_, _| Some(status(404, r#"{"error":"model not found"}"#))), "", "m").await), Some((ProbeCause::TryModel, Some(404))));
        assert_eq!(cause_of(recorder.attempt(&serve(|_, _| Some(status(401, "{}"))), "", "m").await), Some((ProbeCause::KeyRequired, Some(401))));
        assert_eq!(cause_of(recorder.attempt(&serve(|_, _| Some(status(401, "{}"))), KEY, "m").await), Some((ProbeCause::KeyRejected, Some(401))));
        assert_eq!(cause_of(recorder.attempt(&serve(|_, _| Some(status(500, "{}"))), "", "m").await), Some((ProbeCause::TryServer, Some(500))));
        assert_eq!(cause_of(recorder.attempt(&serve(|_, _| Some(status(400, "{}"))), "", "m").await), Some((ProbeCause::TryRejected, Some(400))));
        assert_eq!(cause_of(recorder.attempt(&serve(|_, _| Some(status(200, r#"{"choices":[{"message":{"content":"<think>only</think>"}}]}"#))), "", "m").await), Some((ProbeCause::TryEmpty, Some(200))));
        assert_eq!(cause_of(recorder.attempt(&serve(|_, _| None), "", "m").await), Some((ProbeCause::TryTimeout, None)));
        assert_eq!(cause_of(recorder.attempt(&server, "", "  ").await), Some((ProbeCause::TryModel, None)), "no model chosen");
        assert_eq!(cause_of(recorder.attempt("", "", "m").await), Some((ProbeCause::AddressEmpty, None)));
        // A long reply is cut for the interface.
        let long = "mot ".repeat(200);
        assert_eq!(parse_reply(&serde_json::json!({ "choices": [{ "message": { "content": long } }] })).unwrap().chars().count(), 200);
        assert_eq!(parse_reply(&serde_json::json!({ "choices": [{ "text": "Bonjour" }] })).as_deref(), Some("Bonjour"));
        assert_eq!(parse_reply(&serde_json::json!({ "choices": [] })), None);
        assert_eq!(serde_json::to_value(&done).unwrap(), serde_json::json!({ "run": "try-1", "ok": true, "reply": "Bonjour, la réunion commence à dix heures.", "ms": done.ms }));
    }

    #[test]
    fn every_cause_has_its_code() {
        let all = [
            (ProbeCause::AddressEmpty, "address.empty"), (ProbeCause::AddressMalformed, "address.malformed"), (ProbeCause::AddressScheme, "address.scheme"), (ProbeCause::AddressCredentials, "address.credentials"), (ProbeCause::AddressDns, "address.dns"),
            (ProbeCause::ReachRefused, "reach.refused"), (ProbeCause::ReachTimeout, "reach.timeout"), (ProbeCause::ReachTls, "reach.tls"), (ProbeCause::ReachCertificate, "reach.certificate"), (ProbeCause::ReachNetwork, "reach.network"),
            (ProbeCause::KeyRequired, "key.required"), (ProbeCause::KeyRejected, "key.rejected"),
            (ProbeCause::ModelsNotFound, "models.notfound"), (ProbeCause::ModelsEmpty, "models.empty"), (ProbeCause::ModelsInvalid, "models.invalid"), (ProbeCause::ModelsServer, "models.server"),
            (ProbeCause::TryModel, "try.model"), (ProbeCause::TryRejected, "try.rejected"), (ProbeCause::TryServer, "try.server"), (ProbeCause::TryTimeout, "try.timeout"), (ProbeCause::TryEmpty, "try.empty"),
        ];
        for (cause, code) in all {
            assert_eq!(cause.code(), code);
        }
        assert_eq!(ProbeCause::Cancelled.code(), "cancelled");
        assert_eq!(ProbeCause::of_transport(Cause::Certificate), ProbeCause::ReachCertificate);
        assert_eq!(ProbeCause::of_transport(Cause::Reset), ProbeCause::ReachNetwork);
        assert_eq!(serde_json::to_value(initial_steps()).unwrap()[0], serde_json::json!({ "id": "address", "state": "waiting" }));
    }
}
