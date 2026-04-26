use std::fmt;

pub(crate) type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Error {
    pub(crate) reason: String,
}

impl Error {
    pub(crate) fn from_reason(reason: impl Into<String>) -> Self {
        Self {
            reason: reason.into(),
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.reason)
    }
}

impl std::error::Error for Error {}

#[cfg(not(all(test, target_os = "macos")))]
impl From<Error> for napi::Error {
    fn from(error: Error) -> Self {
        napi::Error::from_reason(error.reason)
    }
}
