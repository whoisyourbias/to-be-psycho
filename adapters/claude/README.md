# Claude Code adapter

Documentation checked 2026-10-02; no Claude Code binary/version is available in this executor. Definition compatibility and runtime enforcement are not live-tested.

Install discovery paths are `.claude/skills/learning-with-to-be-psycho/SKILL.md` and `.claude/agents/implementation-reviewer.md` beneath the explicitly selected project/home root. Bundle copies make references self-contained. Start with `/learning-with-to-be-psycho` or ask to use the named skill; verify discovery in the installed host before claiming it works.

The reviewer uses an explicit Read/Glob/Grep allowlist and no memory field. Do not add Bash, Write, Edit, MCP mutation tools or memory to make a blocked review work. These settings are based on the [official subagent documentation](https://code.claude.com/docs/en/sub-agents), which describes tool allowlists and automatic write/edit tools for memory-enabled agents. Skill `allowed-tools` is not a denylist or substitute for this agent restriction. See [skills](https://code.claude.com/docs/en/skills).

Before an independent review, verify the loaded definition and actual available tool set in an isolated fixture. If unavailable, use the main guide's sequential contract with independent=false. The main guide defaults to text/read-only and manual state saving until state-only write isolation is proven. Do not loosen source permissions. Claude OS sandbox availability differs by OS, so Windows native and macOS are separate untested acceptance targets; see [sandboxing](https://code.claude.com/docs/en/sandboxing).

The source definition links the repository contract; buildPackage rewrites it to the installed skill's local core/review-contract.md. No user root CLAUDE.md or settings file is installed or edited.
