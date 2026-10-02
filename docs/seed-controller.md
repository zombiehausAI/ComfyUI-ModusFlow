# Master Seed Controller

Centralized master seed distribution node for ModusFlow workflows.

## Overview

The **ModusFlow Master Seed** node (`ModusFlowSeedController`) synchronizes generation seeds across your entire workflow. Instead of configuring seeds in separate nodes, a single Master Seed node distributes identical seeds to **KSampler**, **ModusFlowTextEditor** (for deterministic evaluation of `{a|b|c}`, `{shuffle:...}`, and wildcards), and **ModusFlowLoraLoader** (for the LoRA Random Pool).

## Features

- **Action Modes**:
  - `randomize`: Generates a fresh 64-bit random seed on every queue cycle.
  - `fixed`: Keeps the exact typed seed for reproducible image generations.
  - `increment`: Automatically increases seed by +1 on every generation (great for linear variation testing).
  - `decrement`: Automatically decreases seed by -1 on every generation.
- **Dual Outputs**:
  - `seed` (`INT`): Connects to KSampler, Text Editor, and LoRA Loader.
  - `seed_text` (`STRING`): String representation for filename tags, Show Text, or prompt embeddings.

## Inputs

- **seed** (INT, default: 0): Numeric seed base.
- **action** (COMBO): `["randomize", "fixed", "increment", "decrement"]`.

## Outputs

| Output | Type | Description |
|---|---|---|
| `seed` | INT | Evaluated integer seed |
| `seed_text` | STRING | Text representation of the seed |

## Usage Pattern

```
                  ┌──► ModusFlow Text Editor (seed)
                  │
[Master Seed] ────┼──► ModusFlow LoRA Loader (seed)
                  │
                  └──► KSampler (seed)
```
