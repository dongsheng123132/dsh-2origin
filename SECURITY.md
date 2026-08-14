# Security

Report vulnerabilities privately through GitHub Security Advisories for this repository.

The DSH tools and CLI read only a state file relative to an explicitly configured workspace root. Traversal and symlink escape are refused. Freeze is the only write operation; it targets a separate relative directory, requires the currently observed SHA-256 as an optimistic-lock credential, uses exclusive creation, and verifies the artifact by reading it back. The live state is never modified.

The MCP server does not read or write the filesystem. It accepts bounded inline JSON documents, refuses secret-shaped keys, and returns proof metadata, hashes, counts and changed-field hashes rather than state prose. Do not send secret-bearing task state to any tool or transport.
