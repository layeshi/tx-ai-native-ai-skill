# Tx-AI Native AI skill

Install for Codex from the stable tag:

```bash
python ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo layeshi/tx-ai-native-ai-skill --path skills/tx-ai-native-ai --ref v1.0.3
```

Claude Code users can copy `skills/tx-ai-native-ai` into their configured skills directory.

Installation does not grant platform access. The guided setup may offer the default Tx-AI site `https://ai.spaceexplorer.cn/agent-access`; it must ask for confirmation before opening it. If you decline, enter your own Tx-AI platform root URL and the setup opens `<your-root>/agent-access` instead. Then sign in with an administrator account, create a personal Agent credential with the required capability and data scope, and save the one-time token in secure Agent settings or environment variables. Capability authorization and data scope are separate: selecting all capabilities does not grant access to every workspace, conversation, object, or result.

```bash
export PLATFORM_BASE_URL='https://your-tx-ai.example'
export PLATFORM_AGENT_TOKEN='txai_<grant-id>.<secret>'

./scripts/check-auth.sh
unset PLATFORM_AGENT_TOKEN
```

The platform currently has no OAuth or device-code flow. This skill never creates accounts, shares credentials, substitutes provider keys, or bypasses authorization. Run the setup and check in the same shell so variables are inherited. If the skill already exists, inspect its `SKILL.md` and upgrade explicitly with the command above; do not claim a new version was installed after a destination-exists error. Never read, log, or paste the complete one-time token.
