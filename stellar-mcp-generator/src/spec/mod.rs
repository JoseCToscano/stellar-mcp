//! Contract specification fetching and parsing

mod fetcher;
mod parser;
pub mod types;

pub use fetcher::SpecFetcher;
pub use parser::SpecParser;
pub use types::*;
