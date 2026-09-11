# Tx-AI Native AI skill

Install for Codex from the stable tag:

```bash
python ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo layeshi/tx-ai-native-ai-skill --path skills/tx-ai-native-ai --ref v1.0.0
```

Claude Code users can copy `skills/tx-ai-native-ai` into their configured skills directory.

Installation does not grant platform access. Open your Tx-AI deployment's `/agent-access` page, sign in with an administrator account, create a personal Agent credential with the smallest required scope, and save the one-time token in secure Agent settings or environment variables:

```bash
export PLATFORM_BASE_URL='https://your-tx-ai.example'
export PLATFORM_AGENT_TOKEN='txai_<grant-id>.<secret>'
```

The platform currently has no OAuth or device-code flow. This skill never creates accounts, shares credentials, substitutes provider keys, or bypasses authorization. Run `./scripts/check-auth.sh` after configuring the variables.
