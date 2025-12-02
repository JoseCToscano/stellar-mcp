//! Project scaffolding and file writing

use std::fs;
use std::path::Path;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

/// Create the complete directory structure for a generated policy project
pub fn create_directory_structure(
    output_dir: &str,
    policy_name: &str,
) -> Result<(), std::io::Error> {
    let base = Path::new(output_dir);

    // Create contracts directory structure
    fs::create_dir_all(base.join("contracts").join(policy_name).join("src"))?;

    // Create examples directory
    fs::create_dir_all(base.join("examples"))?;

    Ok(())
}

/// Write a file with the given content
pub fn write_file(path: &str, content: &str) -> Result<(), std::io::Error> {
    // Ensure parent directory exists
    if let Some(parent) = Path::new(path).parent() {
        fs::create_dir_all(parent)?;
    }

    fs::write(path, content)?;
    Ok(())
}

/// Write all generated files to the output directory
pub fn write_all_files(
    output_dir: &str,
    files: Vec<(String, String)>,
) -> Result<(), std::io::Error> {
    for (relative_path, content) in files {
        let full_path = Path::new(output_dir).join(&relative_path);
        write_file(full_path.to_str().unwrap(), &content)?;

        // Set executable permissions for shell scripts (Unix only)
        #[cfg(unix)]
        if relative_path.ends_with(".sh") {
            let mut perms = fs::metadata(&full_path)?.permissions();
            perms.set_mode(0o755); // rwxr-xr-x
            fs::set_permissions(&full_path, perms)?;
        }
    }

    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_create_directory_structure() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().to_str().unwrap();

        let result = create_directory_structure(output_path, "test-policy");
        assert!(result.is_ok());

        // Verify directories were created
        assert!(temp_dir.path().join("contracts").exists());
        assert!(temp_dir.path().join("contracts/test-policy").exists());
        assert!(temp_dir.path().join("contracts/test-policy/src").exists());
        assert!(temp_dir.path().join("examples").exists());
    }

    #[test]
    fn test_write_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");

        let result = write_file(file_path.to_str().unwrap(), "test content");
        assert!(result.is_ok());

        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "test content");
    }

    #[test]
    fn test_write_file_creates_parent_dirs() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("nested/dir/test.txt");

        let result = write_file(file_path.to_str().unwrap(), "nested content");
        assert!(result.is_ok());

        assert!(temp_dir.path().join("nested").exists());
        assert!(temp_dir.path().join("nested/dir").exists());

        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "nested content");
    }

    #[test]
    fn test_write_all_files() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().to_str().unwrap();

        let files = vec![
            ("file1.txt".to_string(), "content1".to_string()),
            ("dir/file2.txt".to_string(), "content2".to_string()),
            ("another/nested/file3.txt".to_string(), "content3".to_string()),
        ];

        let result = write_all_files(output_path, files);
        assert!(result.is_ok());

        // Verify all files were created with correct content
        let content1 = fs::read_to_string(temp_dir.path().join("file1.txt")).unwrap();
        assert_eq!(content1, "content1");

        let content2 = fs::read_to_string(temp_dir.path().join("dir/file2.txt")).unwrap();
        assert_eq!(content2, "content2");

        let content3 = fs::read_to_string(temp_dir.path().join("another/nested/file3.txt")).unwrap();
        assert_eq!(content3, "content3");
    }
}
