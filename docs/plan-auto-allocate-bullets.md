# Plan: 按 JD 重要程度自动分配各经历 Bullet 数量

## 目标

不再完全依赖 profile 里每条经历的 `bulletCount`，改为由模型在 **Mapping 步骤** 根据「该经历与 JD/痛点的匹配度」自动分配每条经历写几条 bullet，相关性高的多写、低的少写。

## 当前行为

- `profile.yaml` 里每条经历可配置 `bulletCount`（默认 2）、`wordCount`。
- `buildBulletRequirementsAndExperienceList(profile)` 按 profile 生成固定字符串，例如：  
  `Experience 1 (...): Write EXACTLY 3 bullet point(s)...`
- Mapping 的 prompt 要求 **原样照抄** 这段 `bulletRequirements`，所以 Step 4 读到的条数完全来自 profile。

## 方案概述

- **触发方式**：在 profile 顶层增加可选开关 `autoAllocateBullets: true`。为 `true` 时启用「按 JD 重要程度分配」；不设或为 `false` 时保持现有逻辑（仍用 profile 的 `bulletCount`）。
- **分配发生位置**：在 **Step 3 Mapping** 里一并完成。不新增步骤、不增加一次 LLM 调用。Mapping 已有 JD、痛点、公司画像和完整经历，最适合做「相关性 → 条数」决策。
- **输出形态**：仍输出 `PER-EXPERIENCE BULLET REQUIREMENTS` 与 `EXPERIENCE LIST` 两个块；当启用自动分配时，**PER-EXPERIENCE BULLET REQUIREMENTS 由模型按规则生成**，不再从 profile 预计算并「照抄」。

---

## 实现步骤

### 1. Profile 与类型

- **profile.example.yaml**：在顶层（与 `personal`、`experiences` 同级）增加示例：
  ```yaml
  # optional: when true, bullet count per experience is decided by mapping step based on JD relevance
  # autoAllocateBullets: true
  ```
- **src/types/profile.ts**：在 `ProfileSchema` 中增加可选字段：
  ```ts
  autoAllocateBullets: z.boolean().optional(),
  ```

### 2. 生成「分配说明」而非固定条数（generate.ts）

- 在 **buildBulletRequirementsAndExperienceList** 的调用处根据 profile 是否启用 `autoAllocateBullets` 分支：
  - **未启用**：行为不变，仍用当前函数生成 `bulletRequirements` 字符串（来自各条 `bulletCount` / `wordCount`）。
  - **启用**：不生成具体条数，改为生成一段**给模型的分配说明**（见下），作为 `bulletRequirements` 传入 mapping 模板；`experienceList` 仍由当前函数生成（公司名 + 角色，一行一条）。
- 新增一段固定文案（可放在常量或模板里），用于替换「照抄 block」的说明，例如（中英按现有模板语言二选一或都支持）：

  **中文**（与现有 mapping 一致时）：
  ```
  请根据 JD 与痛点，为下面每条经历分配 bullet 条数与字数要求。按「与 JD/痛点越相关则条数越多」的原则分配。
  约束：每条经历 1–4 条；第一条经历至少 2 条；全部经历总条数建议在 10–14 之间（经历少于 4 段时可 8–12）；字数可写 "20-25" 或 "25-30"。
  对第一条经历，若提供了公司画像，在要求末尾加一句："For the first experience add 1–2 bullets tied to the target company if company profile provided."
  输出格式：每行一条经历，形如
  Experience N (公司 - 角色): Write EXACTLY X bullet point(s), each approximately Y words. [首条时的额外句可选]
  ```

  **英文**（en 模板）：
  ```
  Allocate bullet counts per experience based on relevance to the JD and pain points. More relevant experiences get more bullets.
  Constraints: 1–4 bullets per experience; first experience at least 2; total bullets 10–14 (or 8–12 if fewer than 4 experiences). Word count per bullet: "20-25" or "25-30".
  For the first experience, if company profile was provided, append: "For the first experience add 1–2 bullets tied to the target company if company profile provided."
  Output one line per experience: Experience N (Company - Role): Write EXACTLY X bullet point(s), each approximately Y words. [optional extra for first]
  ```

- 这样：**当启用自动分配时**，mapping 收到的 `bulletRequirements` 是一段「请按上述规则生成下面的 block」，而不是一串已写好的 "Experience 1: ... 3 bullets..."。

### 3. Mapping 模板（中英两套）

- **当前**：PER-EXPERIENCE BULLET REQUIREMENTS 小节写的是「Copy the following block EXACTLY: {{bulletRequirements}}」。
- **改为**：根据传入的 `bulletRequirements` 是「预计算好的 block」还是「分配说明」来区分两种行为，有两种做法（任选其一）：
  - **做法 A（推荐）**：在 generate 里根据 `autoAllocateBullets` 传入两个不同的占位符或两段不同文案：
    - 未启用：`bulletRequirementsInstruction` 为空或「Copy EXACTLY」，`bulletRequirements` 为已生成 block。
    - 启用：`bulletRequirementsInstruction` 为上面那段分配说明，`bulletRequirements` 可为空或同一段说明的重复（便于模型只看一处就懂）。
  - **做法 B**：模板里不区分，统一写：「若下面是一段“分配说明”，则请按说明生成 PER-EXPERIENCE BULLET REQUIREMENTS block；若下面是已写好的 block，则原样照抄。」这样只需一段 `bulletRequirements` 文案，但模型需要做分支理解，略容易出错。
- 推荐 **做法 A**：在 `generate.ts` 中：
  - 若 `!profile.autoAllocateBullets`：`bulletRequirements` = 当前 `buildBulletRequirementsAndExperienceList().bulletRequirements`，`bulletRequirementsInstruction` = 空字符串。
  - 若 `profile.autoAllocateBullets`：`bulletRequirements` = 空或与 instruction 相同的一段说明，`bulletRequirementsInstruction` = 上面的分配说明。
- 模板中：
  - 当 `bulletRequirementsInstruction` 非空：写「Generate the PER-EXPERIENCE BULLET REQUIREMENTS block according to the following instructions: {{bulletRequirementsInstruction}}」且注明「Do not copy; write the block yourself based on EXPERIENCE LIST and JD relevance.」。
  - 当 `bulletRequirementsInstruction` 为空：保留现有「Copy the following block EXACTLY: {{bulletRequirements}}」。
- 需同时改：`templates/mapping.jsonprompt`，以及 generate 里 `renderTemplate` 传入的变量（增加 `bulletRequirementsInstruction` 或等价物）。

### 4. Step 4 Experience Bullets

- Step 4 仍然只读 **mapping 的原始输出**，从其中解析出 `PER-EXPERIENCE BULLET REQUIREMENTS` 和 `EXPERIENCE LIST`。
- 不需要改解析逻辑：无论条数是 profile 写死还是模型在 mapping 里生成的，最终都体现在 mapping 文本里的同一块中，格式保持一致（每行 `Experience N (...): Write EXACTLY X bullet point(s)...`）。

### 5. Regenerate 与审查

- Regenerate 使用的 mapping 已是「含 PER-EXPERIENCE BULLET REQUIREMENTS 的完整 mapping」；自动分配后该块只是改为由模型在 Step 3 生成，格式不变，因此 **regenerate 和 review 无需改**，只要 mapping 里该块格式一致即可。

### 6. 文档与默认

- README 或 docs 中简短说明：开启 `autoAllocateBullets: true` 后，每条经历的 bullet 数量由 Mapping 步骤根据对 JD 的重要程度自动分配，profile 里该经历的 `bulletCount` 在自动分配模式下可被忽略（可选：实现时若启用自动分配，可显式忽略 profile 的 bulletCount，避免混淆）。
- 默认不开启（不设或 `false`），保持与现有行为兼容。

---

## 约束与规则小结（给模型）

- 每条经历：1–4 条 bullet；第一条至少 2 条。
- 总条数：约 10–14（经历少时可 8–12）。
- 字数：每条约 20–25 或 25–30 词，由模型在要求里写清。
- 第一条经历：若有公司画像，在要求中保留「add 1–2 bullets tied to the target company」的说明。

---

## 文件改动清单

| 文件 | 改动 |
|------|------|
| `profile.example.yaml` | 增加 `autoAllocateBullets` 注释示例 |
| `src/types/profile.ts` | `ProfileSchema` 增加 `autoAllocateBullets?: boolean` |
| `src/commands/generate.ts` | 读取 `autoAllocateBullets`；分支构建 `bulletRequirements` / `bulletRequirementsInstruction`；mapping 渲染时传入新变量 |
| `templates/mapping.jsonprompt` | 支持「按说明生成」PER-EXPERIENCE BULLET REQUIREMENTS（条件文案） |
| `docs/plan-auto-allocate-bullets.md` | 本计划（可选：README 加一小节说明） |

---

## 可选增强（后续）

- 在 profile 中支持**混合模式**：部分经历写死 `bulletCount`，其余经历由模型分配（例如只对「最近 2 段」自动分配，更早经历固定 1–2 条）。实现上可在分配说明中注明「Experience K 与 L 的条数固定为 X、Y，其余按 JD 相关性分配」。
- 总条数上限可做成可配置（如 profile 或 job 级），便于控制简历长度。
