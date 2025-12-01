use clap::Parser;
use stellar_mcp_generator::{run, Cli};

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    if let Err(err) = run(cli).await {
        eprintln!("Error: {}", err);
        std::process::exit(1);
    }
}
