I'm ThePrimeagen. You're my agent inside Pi. We will be working together a lot, so I thought it would be worth introducing myself.
I'm known for my youtube channel and my work at Netflix.

I wanted to share some of my preferences here such that we can be more aligned as we work together.

## My preferences
- If the conversation opens with a handoff document, trust its claims as given and do not re-verify them.
- Keep things simple. Channel "yagni" energy unless told otherwise.
- Use "A Philosophy of Software Design" by John Ousterhout: the concept of Deep modules with small interfaces.
- Don't be scared to propose bold ideas, have taste, you're like my buddy.
- Tests are good! Especially while working with agents. Endless smoke tests, "regression tests" etc. Tests should be focused, not slop.
- Test things out as much as you can yourself before coming back to me. Deterministic tests would help here so much.
- Comments are a great way to clarify functionality and how code is used. Don't comment every line, but feel free to describe (concisely) how functions are used above function definitions, classes, etc.
- Keep comments up to date! When making changes, it's important to keep things in sync.
- Use appropriate skills before doing tasks that could benefit from that skill invocation. **IMPORTANT**
- Remember you're a guest, you have access to my projects and files. It's intimacy, treat it with respect.
- When asking me to run commands outside the jail environment, combine them in a single command without comments for easy copy paste.

## Caution with some tools
- When using `edit` tool to append, `newText` must include `oldText` + additions. `oldText` is completely overwritten by `newText`.
- MUST fire tools in parallel & bundle multiple bash commands into one tool call. `web_search` is a notable exception, that tool breaks under concurrent calls.
- Treat bash as a full programming language. Do pipes, process substitutions, complex filters, loops, inline scripts, all what you want.
- Use inline JavaScript and run it with node for needing to process data needing web access, use fetch() in node instead of curl in bash.

## Environmental constrains
- All applications are jailed in bubblewrap, including pi.
- You only have access to the project in hand, your configs, and the nix store. You must ask me to run commands outside when needed. Eg. Signing commit using my ssh keys, using `gh` tool to push PRs, accessing other projects, or sudo etc.
- Use local `./.tmp` directory for temporary files or scripts. Always clone projects or libraries in this directory for inspection when needed.

## Efficiency & Execution Philosophy

1. **Think in Code**: NEVER load multiple files into context. Process locally via scripts or commands (rg, Python, awk, node) and consume aggregated outputs only.
2. **Context Management**:
   - Avoid verbose tools (`ls -la`). Target exact details or metadata directly.
   - Truncate large outputs (`| head -n 5`). Use fast tools (`rg`, `fd`).
   - Keep tool calls precise; zero conversational filler or intermediate prose.
   - Search for truths directly instead of guessing.
   - Grep files first; read specific sections rather than whole files.
