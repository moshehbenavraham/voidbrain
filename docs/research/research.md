# Open-source "Obsidian second brain" style apps and tools

## Overview

"Second brain" tools combine personal knowledge management (PKM), graph- or outline-based notes, and sometimes AI to help users offload and organize their thinking. Obsidian is a popular local-first, markdown-based PKM app with a large plugin ecosystem, but its core app is source-available/proprietary rather than fully open source. As a result, many developers have created open-source Obsidian plugins and external runtimes that add AI "second brain" capabilities on top of an Obsidian vault, as well as fully open-source Obsidian-like apps.[^1][^2][^3][^4][^5]

## Scope and caveats

The phrase "Obsidian second mind/second brain" is used informally across blogs, GitHub repos, and plugin descriptions, so there is no canonical global list. This report focuses on:[^4][^6]

- Open-source Obsidian plugins or skills explicitly designed to turn an Obsidian vault into an AI-augmented second brain.
- Open-source Obsidian vault templates or starter kits centered on AI/agentic workflows.
- Open-source second-brain/PKM apps that are frequently cited as open-source Obsidian alternatives.

Many personal vault repos on GitHub use "second brain" in their description but are just private note dumps, not reusable tools, so they are not included unless they expose reusable code or a pattern.[^7]

## Open-source Obsidian AI second-brain skills and plugins

### claude-obsidian

- **Type:** Obsidian + Claude Code skill / system, open source (MIT).[^8][^9][^10]
- **Repo:** `AgriciDaniel/claude-obsidian` on GitHub.[^10]
- **What it does:** Implements Andrej Karpathy's "LLM wiki" pattern on top of an Obsidian vault: ingest sources, create 8-15 interlinked wiki pages per source, manage an index, and run autonomous research and vault maintenance workflows.[^9][^8]
- **Second-brain features:**
  - Automatic creation of entities, concepts, and cross-references when ingesting documents, so the vault evolves into a structured wiki over time.[^8][^9][^10]
  - "Hot cache" session memory that preserves about one screen (~500 words) of context between conversations, reducing recap overhead.[^8]
  - Autonomous research command that runs multi-round web research, files results into the wiki, and maintains the vault with lint checks for orphans, dead links, and content gaps.[^10][^8]
  - Works across multiple tools (Claude Code, Gemini CLI, Codex CLI, Cursor, Windsurf) rather than being tied to a single AI provider.[^8]

### obsidian-Smart2Brain (Smart Second Brain)

- **Type:** Obsidian community plugin, fully open source.[^11][^12][^13]
- **Repo:** `your-papa/obsidian-Smart2Brain` (plugin ID `smart-second-brain`).[^12][^11]
- **What it does:** A local-first AI assistant for Obsidian that lets you chat with your vault and get links back to the underlying notes.[^13][^14]
- **Second-brain features:**
  - Treats your Obsidian vault as a "smart second brain" by using RAG over your notes, with support for local models via Ollama as well as remote providers like OpenAI, Gemini, and others.[^14][^11][^13]
  - Emphasizes privacy and offline operation by supporting fully local inference and avoiding external services if desired.[^11][^13]
  - Uses LangChain and Orama as a vector store and applies hierarchical tree summarization in its pipeline to better structure and retrieve notes.[^13][^11]

### Obsidian Second Brain Claude Code skill (MCP / CLI skill)

- **Type:** Claude Code / MCP skill that automates Obsidian vault operations via the terminal; distributed as an open-source skill.[^15][^16][^17]
- **What it does:** Provides a CLI-first interface for Claude to read, create, and modify notes in an Obsidian vault, including wikilink resolution, daily notes, task management, frontmatter edits, and template integration.[^17]
- **Second-brain features:**
  - Designed for PKM users who want Claude as a copilot for capturing, organizing, and querying knowledge in Obsidian.[^17]
  - Exposed through `obsidian-second-brain` skill installations via `git clone` into the Claude skills directory, then a setup script.[^16][^17]
  - Integrates with the wider Claude Code ecosystem and can be combined with LLM wiki-style flows or other skills for autonomous research.[^15][^17]

### COG-second-brain (Claude + Obsidian + Git)

- **Type:** Pattern/repo for a self-evolving second brain built on Claude + Obsidian + Git, open source.[^18][^19][^20]
- **Repo:** `huytieu/COG-second-brain`.[^20][^18]
- **What it does:** Defines an Obsidian vault structure plus Claude automation that analyzes braindumps, finds patterns, updates cross-references, synthesizes news summaries, and consolidates insights into frameworks, all stored as markdown synced via Git/iCloud.[^19][^18]
- **Second-brain features:**
  - Uses Claude Code as an agent that reads the whole vault, updates links, and files synthesized knowledge back into atomic notes.[^18][^19]
  - Distributed with setup scripts and templates so others can clone and adapt the system.[^18]

### Obsidian Second Brain PKM Vault org

- **Type:** GitHub organization providing a structured Obsidian PKM vault aimed at building a "Second Brain".[^21]
- **Repo/org:** `Obsidian-Second-Brain` on GitHub.[^21]
- **What it does:** Ships an opinionated vault layout, templates, and workflows for research and PKM, which can be used as the substrate for AI tools like Claude-Obsidian or Smart Second Brain.[^10][^21]

### Other Obsidian-related second-brain utilities

GitHub topics around "second-brain" and "obsidian" show numerous small or personal projects that interact with Obsidian notes as a second brain.[^22][^7]
Examples include:

- `yigal100/second-brain` - a personal knowledge base managed via Obsidian; more of a vault than a reusable tool.[^7]
- `zarazinsfuss/quak` - a shell utility for managing Quartz-based digital garden notes that can interoperate with Obsidian-style markdown.[^7]
- Various Vim plugins (for example, `sb.vim`) that connect a second brain CLI with editors, often assuming an Obsidian-like markdown PKM structure.[^7]

Because these are either highly personal vaults or thin wrappers around generic note operations, they are not as complete as the dedicated AI second-brain plugins above.

## Open-source Obsidian alternatives for a second brain

Because Obsidian itself is not fully open source, many users prefer open-source apps that replicate the local-first, markdown-based, graph/outline-centric "second brain" experience. The following tools are commonly recommended.[^23][^2][^3]

### Logseq

- **Type:** Local-first, open-source outliner and PKM app.[^2][^3][^23]
- **Second-brain characteristics:**
  - Block-based outliner with daily notes, backlinks, and a graph view inspired by Roam/Obsidian, optimized for "linked thinking" workflows.[^3][^24][^23]
  - Uses plain text (Org-mode/Markdown) in a local folder, aligning with second-brain goals of data ownership and longevity.[^23][^3]
  - Supports plugins and integrations, and is often positioned explicitly as an open-source Obsidian alternative for second-brain users.[^24][^3]

### Joplin

- **Type:** Open-source note-taking app with plugin ecosystem and encryption.[^25][^24][^23]
- **Second-brain characteristics:**
  - Markdown notes organized into notebooks with tags, plus optional end-to-end encryption and flexible storage backends.[^24][^23]
  - Community plugins enable backlinks, graph views, and Git-based versioning, enabling a "version-controlled second brain" system.[^25][^23][^24]

### Trilium Notes

- **Type:** Open-source hierarchical note-taking and PKM tool.[^23]
- **Second-brain characteristics:**
  - Focus on building a knowledge tree with rich linking, publishing, and optional drawing canvas, suitable for second-brain style knowledge bases.[^23]

### Notabase

- **Type:** Open-source, web-first second-brain app inspired by Notion, Obsidian, Roam, etc.[^26]
- **Second-brain characteristics:**
  - Supports bidirectional links, graph view, block references, and full-text search across notes, all synced to the cloud and accessible across devices.[^26]
  - Designed explicitly as a "second brain for your knowledge, thoughts, and ideas" with export/import capabilities.[^26]

### AppFlowy, QOwnNotes, Anytype, Outline, and others

- **AppFlowy:** Open-source attempt at a Notion-like workspace that can be used as a second brain and supports self-hosted sync.[^23]
- **QOwnNotes:** Qt-based markdown note app with Nextcloud/ownCloud integration, tags, and script-based extensibility; often used for PKM.[^23]
- **Anytype:** Source-available decentralized note and knowledge app with local-first, peer-to-peer sync; can be used for second-brain workflows.[^23]
- **Outline:** Team-focused knowledge base, source-available but with a non-open-source-compatible license; often used as a shared second brain.[^23]

## AI runtimes and frameworks branded as "second brain"

Several projects use "Second Brain" in their name for broader AI knowledge runtimes rather than Obsidian-specific tools. They can still be wired into Obsidian or Obsidian-like vaults.

### henrydaum/second-brain

- **Type:** Local-first AI runtime and tool orchestrator branded as "Second Brain".[^27]
- **What it does:** Indexes local files, remembers durable context, searches the web, and runs tools; designed as an AI layer over your filesystem and knowledge sources.[^27]
- **Relation to Obsidian:** Can index the same markdown vault that Obsidian uses but is not tightly coupled to Obsidian.[^27]

### NicholasSpisak/second-brain

- **Type:** LLM-maintained personal wiki / knowledge base based on Karpathy's LLM Wiki pattern.[^28]
- **What it does:** Uses an AI coding agent (Claude) to maintain a markdown knowledge base (personal wiki), treating it as a second brain.[^28]
- **Relation to Obsidian:** The underlying data model (markdown wiki with backlinks) is compatible with Obsidian-style PKM, though Obsidian is not a hard dependency.[^28]

### Other second-brain repos and frameworks

GitHub topics for "second-brain" reveal many small frameworks or personal stacks (for example, LifeOS/Metabrain, cross-platform apps, Vim integrations) that approach the same idea: a structured, linked knowledge base plus automation and agents.[^29][^22][^7]

## How to keep discovering more

Because the "second brain" meme is evolving fast, new open-source projects appear regularly.

To discover more:

- Monitor GitHub topics like `second-brain`, `obsidian`, `personal-knowledge-management`, and `tools-for-thought` and sort by most recently updated.[^22][^7]
- Watch Obsidian's community plugin directory (especially AI and "second brain" tagged plugins) for new open-source releases.[^12]
- Follow blogs and communities focused on Claude + Obsidian setups, which frequently link to new skills and repos (for example, claude-obsidian and related tutorials).[^30][^9][^8]

Although no exhaustive global registry exists, the tools above cover many of the major open-source and Obsidian-adjacent "second brain" systems that are actively maintained as of early 2026.[^2][^8][^23]

---

## References

1. [Obsidian - Sharpen your thinking](https://obsidian.md) - The free and flexible app for your private thoughts.

2. [17 Best Second Brain Apps in 2026 (Tested & Ranked)](https://buildin.ai/blog/best-second-brain-apps-2026) - Obsidian remains the gold standard for users who prioritize privacy and long-term data durability in...

3. [Open Source Obsidian Alternatives for AI Workflows](https://nimbalyst.com/blog/open-source-obsidian-alternatives-ai-workflows/) - Obsidian is excellent at personal knowledge management. It is local-first, markdown-based, fast, ext...

4. [7 Best Second Brain Apps (2026): The Cognitive-Load ... - Atlas](https://www.atlasworkspace.ai/blog/best-second-brain-apps) - Pick by retrieval style: graph (Obsidian, Roam), spatial (Heptabase), or AI-cited (Atlas). Useful re...

5. [PKM Tools, Self-Hosted Wikis & Digital Systems - Rost Glukhov](https://www.glukhov.org/knowledge-management/) - Using Obsidian for Personal Knowledge Management walks through Obsidian from vault setup through the...

6. [This Is Your Second Brain on OpenClaw | Ron Forbes](https://www.ronforbes.com/blog/openclaw-and-your-second-brain) - The second brain movement - Tiago Forte's Building a Second Brain, the rise of Obsidian, Notion, per...

7. [second-brain - GitHub Topics](https://github.com/topics/second-brain?o=asc&s=stars) - A simple system for managing your knowledge with bash. bash markdown knowledge notes note-taking bas...

8. [Obsidian AI Second Brain: The Open-Source Plugin That ...](https://agricidaniel.com/blog/claude-obsidian-ai-second-brain) - Instead of embedding your notes into vectors and doing semantic search, you structure them as plain ...

9. [How to Build an AI Second Brain with Claude Code and Obsidian](https://claude-blog.md/blog/claude-obsidian-second-brain) - claude-obsidian is the practical implementation, free, open source, available in two minutes. Plugin...

10. [AgriciDaniel/claude-obsidian: Claude ...](https://github.com/AgriciDaniel/claude-obsidian) - Option 1: Clone as vault (recommended: full setup in 2 minutes). git clone https://github.com/Agrici...

11. [your-papa/obsidian-Smart2Brain: An ...](https://github.com/your-papa/obsidian-smart2brain) - Your Smart Second Brain is a free and open-source Obsidian plugin to improve your overall knowledge ...

12. [smart-second-brain - Obsidian Hub](https://publish.obsidian.md/hub/02+-+Community+Expansions/02.05+All+Community+Expansions/Plugins/smart-second-brain) - GitHub all releases GitHub manifest version GitHub issues by-label ![GitHub Repo. ... Plugin ID: sma...

13. [New Plugin: Smart Second Brain - Local AI Assistant](https://www.reddit.com/r/ObsidianMD/comments/1btwsjj/new_plugin_smart_second_brain_local_ai_assistant/) - Leveraging our AI assistant turns your Obsidian vault into a smart second brain. Features. Chat with...

14. [Smart Second Brain - Obsidian Plugin](https://www.obsidianstats.com/plugins/smart-second-brain) - The Smart Second Brain plugin enhances knowledge management in Obsidian by integrating AI-powered as...

15. [Seamless Content Ingestion for Claude-Obsidian Second Brain](https://www.jdhwilkins.com/seamless-content-ingestion-for-claude-obsidian-second-brain) - Explore seamless content ingestion for the Claude-Obsidian second brain. Discover tips on efficientl...

16. [[Recommendation] obsidian-second-brain by Eugeniu ...](https://github.com/hesreallyhim/awesome-claude-code/issues/1723) - Install via git clone https://github.com/eugeniughelbur/obsidian-second-brain ~/.claude/skills/obsid...

17. [Obsidian Second Brain Claude Code Skill](https://mcpmarket.com/tools/skills/obsidian-second-brain) - Enhance your productivity with the Obsidian Second Brain Claude Code skill. Automate note-taking, se...

18. [I Finally Built a Second Brain That I Actually Use (6th Attempt)](https://dev.to/huy_tieu/i-finally-built-a-second-brain-that-i-actually-use-6th-attempt-4075) - What is COG? COG = Claude + Obsidian + Git. It's a self-organizing second brain system where: You du...

19. [A Self-Evolving Second Brain (Claude + Obsidian + Git) - ...](https://www.reddit.com/r/ObsidianMD/comments/1oo18gi/i_built_cog_a_selfevolving_second_brain_claude/) - I built COG: A Self-Evolving Second Brain (Claude + Obsidian + Git) - No Database, Just .md Files Th...

20. [huytieu/COG-second-brain: Self-evolving ...](https://github.com/huytieu/COG-second-brain) - Initial COG setup: Self-evolving second brain with Claude + Obsidian ... 7 months ago. README.md - REA...

21. [Obsidian Second Brain](https://github.com/Obsidian-Second-Brain) - Obsidian PKM Vault is a structured repository designed to help you build a powerful Obsidian Second ...

22. [second-brain - GitHub Topics](https://github.com/topics/second-brain?l=css&o=desc&s=stars) - A skilled virtual assistant for Obsidian. chatbot zettelkasten non-linear-note-taking second-brain t...

23. [9 Open Source Second Brain Knowledge Base Tools - It's FOSS](https://itsfoss.com/open-source-second-brain-apps/) - Discover 9 powerful open source second brain and personal knowledge base apps that offer features si...

24. [Best Second Brain Apps in 2026 - TinkeringProd](https://tinkeringprod.com/best-second-brain-apps-in-2026/) - Last Updated: January 17, 2026. Second brain apps are built for people who save ideas everywhere and...

25. [Build a Version-Controlled Second Brain with Joplin and ...](https://dev.to/syedyshiraz/build-a-version-controlled-second-brain-with-joplin-and-github-2ci3) - Build a Version-Controlled Second Brain with Joplin and GitHub. Take notes in Markdown. Save them au...

26. [churichard/notabase](https://github.com/churichard/notabase) - A second brain for your knowledge, thoughts, and ideas. notabase.io. Topics. knowledge-graph note-ta...

27. [henrydaum/second-brain: Second ...](https://github.com/henrydaum/second-brain) - Second Brain is a local-first AI runtime for your machine. It indexes your files, remembers durable ...

28. [NicholasSpisak/second-brain: LLM-maintained personal ...](https://github.com/NicholasSpisak/second-brain) - An AI coding agent - Claude ... Based on Andrej Karpathy's LLM Wiki pattern. Topics. markdown ai kno...

29. [Second Brain - AI-Powered Knowledge Management](https://github.com/violettance/second_brain) - AI-assisted second brain system designed to help you ... nextjs datadog pkm auto-tagging bun zettelk...

30. [I Built a Second Brain That Runs While I Sleep](https://dev.to/simplemindedrobot/i-built-a-second-brain-that-runs-while-i-sleep-4gc1) - Obsidian is open, Claude Code is in the terminal, and I'm writing ... /recall does unified cross-sou...

