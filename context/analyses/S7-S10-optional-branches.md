# S7 / S10 补充：开关怎样改变输入，图片怎样变成请求材料

本补充闭合首版留下的两类局部源码缺口。入口仍是既定 S7/S10，不增加问题或重选 Scope；Scope 正本、commit、留存身份规则见 [README](README.md)。下面只说明生产安装、主要可选分支与 core 消费边界，不展开远程服务、skills selector、审批或记忆算法。

`utils/image/src/lib.rs` 不在原版 59 targets 中；它是所选 core 图片准备的直接被调用工具库。这里仅补读该一个本机文件的尺寸/编码路径，并标为**相邻源码证据**，不冒称 Native Scope 已包含它，不修改契约或计数，也不继续追第三方 image crate codec 内部。

## S7：先查贡献接口，再查使它产生内容的条件

**结论。** 安装列表不是消息列表。notes/记忆/skills/git-attribution 可以贡献片段或 world state；MCP 先贡献 server projection；搜索/图片生成/消息板主要贡献工具；goal/queue 在生命周期或注入接口交接输入。各路最后由已有 core 消费者进入 history 或 Prompt.tools。

生产 [thread_extensions](../../../codex/codex-rs/app-server/src/extensions.rs:50) 的注册顺序和条件已在 [S7 正文](S5-S8-producers.md) 列出。以下按机制分组，不把表的顺序冒称运行顺序。

| 扩展与开关 | 状态、转换、消费者和失败边界 |
|---|---|
| history-notes | [update_config](../../../codex/codex-rs/ext/history-notes/src/extension.rs:46) 同时要求 token_budget.use_history_notes_extension、OpenAI provider、Codex backend auth；否则移除线程配置。thread start 保存 agent path（无则 root），config change 重新判定。[contribute_thread_context](../../../codex/codex-rs/ext/history-notes/src/extension.rs:101) 无 config/identity 返回空；以 session id、agent name、空 JSON 调 thread_hint，Bytes(4000) policy。调用失败、无 text、超过4000 bytes 返回空；空 text 也不贡献。非空成为 ContextWindow / notes.thread_hint 片段。core [初始构造](../../../codex/codex-rs/core/src/session/mod.rs:4358) 只在 TokenBudget 且已知窗口时把 hints 纳入 TokenBudgetContext，因此 backend 返回文字不等于已送模型。同样的 config/identity gate 控制 [notes 工具](../../../codex/codex-rs/ext/history-notes/src/extension.rs:157)，工具结果走 S5。 |
| git-attribution | [world-state producer](../../../codex/codex-rs/ext/git-attribution/src/lib.rs:33) 按 auth generation 查 thread/turn policy；重试延迟期间按 disabled。resolve 成功 Some 缓存 thread，None 在 turn 缓存 disabled；错误在 auth generation 未变时缓存 retry 时间，并本次 disabled；auth generation 改变则循环重取。返回 bool snapshot，经 [renderer](../../../codex/codex-rs/ext/git-attribution/src/world_state.rs:30) 转 developer：enabled+Absent/不同 Known 发启用内容；enabled+Unknown 不重发；disabled+旧 true/Unknown 发关闭说明；disabled+Absent/其他 Known 无文字。snapshot 存在不保证有消息。 |
| memories | MemoryTool feature 与 use_memories 双 gate；读取失败/空/模板失败不贡献；摘要截断、V1/V2 分片及 developer role 已由 [S8](S5-S8-producers.md) 完整说明。读取发生在全量构造，文件变动不自动证明 steady diff。 |
| skills 初始片段 | [thread context](../../../codex/codex-rs/ext/skills/src/extension.rs:189) 无 thread state 或 include_instructions=false 返回空；该 query 不含 executor roots/host/cloud，只按 bundled 配置与 MCP resources 列目录。bounded warnings 发客户端；model flag 控制 usage instructions，metadata budget 控制渲染；非空为 developer capability 片段。该路径不能证明 selected environment/host/cloud 已列入。 |
| skills 逐 step world state | [CatalogContext](../../../codex/codex-rs/ext/skills/src/world_state_catalogs.rs:118) 无 thread state 不贡献；metadata budget 来自 resolved window 与配置。executor 使用 ready capability roots；cloud 需配置和 provider，缺 provider=Unavailable、关闭=Disabled；host 需 provider+HostSkillsSnapshot，include_instructions 或 shadow_selection 才实际列目录。executor/host discovery 在 join 中等待，不证明内部或全局全序。Unavailable 被 [扩展出口](../../../codex/codex-rs/ext/skills/src/extension.rs:250) 过滤。 |
| skills 差量与保留 | [分配](../../../codex/codex-rs/ext/skills/src/world_state_catalogs.rs:263) 只在总预算与 cloud fingerprint 匹配时复用 allocation；cloud cap 可为保全目录缩小。构造 [executor/cloud/host sections](../../../codex/codex-rs/ext/skills/src/world_state_catalogs.rs:436)；[executor renderer](../../../codex/codex-rs/ext/skills/src/world_state.rs:67) 相同 body/开关省略，匹配上次可用 fingerprint 可发短恢复通知；无 body 且 Absent 不发，其余可发 hidden/no-skills。短通知还受 retained body matcher 限制。[cloud/host renderer](../../../codex/codex-rs/ext/skills/src/world_state.rs:143) 比 body/开关/enabled；host 全被预算省略可给 omission 说明。compaction [仅保留 cloud allocation](../../../codex/codex-rs/ext/skills/src/extension.rs:271)，不证明旧目录文本仍在。工具使用 [step query](../../../codex/codex-rs/ext/skills/src/extension.rs:319)，与提示目录不是同一消费对象。 |
| MCP / plugins | [HostedPluginRuntimeExtension](../../../codex/codex-rs/ext/mcp/src/lib.rs:38) 是 McpServerContributor：Apps=false 贡献 Remove，true 贡献 HostedApps config；并非 ContextContributor。core [runtime_config_with_context](../../../codex/codex-rs/core/src/mcp.rs:186) 消费 selected plugins 与 contributor actions，按 feature/disabled id 过滤和归属，形成 runtime projection，再进入工具/能力发现与相关 world state。插件安装不直接追加整段 history。MCP lib 是封闭接口所需的相邻补读，core projection 是原 Scope 所选消费者；不改原模块选集或追服务端。 |
| web-search | [配置](../../../codex/codex-rs/ext/web-search/src/extension.rs:43) 要 OpenAI/actor authorization/standalone 能力之一且 mode 非 Disabled；Cached/Indexed/Live 设置不同 external access。thread start/config change 保存配置；[tools](../../../codex/codex-rs/ext/web-search/src/extension.rs:123) 无配置/不可用返回空。executor 是否选用还受 core 工具 plan 的 feature/model gate；输出经 S5，而非自动 context 文本。 |
| image-generation / board | [image config/tools](../../../codex/codex-rs/ext/image-generation/src/extension.rs:41) 检查 provider OpenAI/requires auth/actor，保存 save_root；无配置/不可用不提供 executor，core plan 再决定是否暴露。board 需 MultiAgentV2+AgentMessageBoard 与成功 Binding，通知/读工具详见 [M8](M8-M10-board-sharing-resume.md)。两者不是直接 thread-context contributor。 |
| goal | 仅有 state_db 时由 app-server 安装，Goals 配置进入 [runtime](../../../codex/codex-rs/ext/goal/src/extension.rs:102)；review 来源不显示 goal 工具，persistent state 控制可用。它注册 [生命周期/usage/tool](../../../codex/codex-rs/ext/goal/src/extension.rs:607)，没有注册 ContextContributor。steering [包装为 goal 来源的 internal user fragment](../../../codex/codex-rs/ext/goal/src/steering.rs:60)，[inject_active_turn_steering](../../../codex/codex-rs/ext/goal/src/runtime.rs:525) 无 manager/thread/活跃 turn 时跳过；存在时交 inject_if_running。返回/注入成功也不证明模型已采样该片段。 |
| queue / guardian-v2 / admission | queue 是可选 caller-owned service，[install](../../../codex/codex-rs/ext/queue/src/lib.rs:14) 注册 lifecycle 并另起 Weak watcher；不等于 ContextContributor，排队输入仍须任务消费。Guardian-v2 [安装](../../../codex/codex-rs/ext/guardian-v2/src/lib.rs:15) scorer/reviewer，专用 reviewer 输入见 [M11](M11-internal-sessions.md)。可选 admission 是 turn-start 控制边界，不因注册就在 Prompt 中产生文字。此处只闭合接口，不展开调度/审批内部算法。 |

错误与取消的共同边界在 [capture step](../../../codex/codex-rs/core/src/session/mod.rs:3843)、[TurnInputContributor 消费](../../../codex/codex-rs/core/src/session/turn.rs:1177) 与 history 记录处；不能把某扩展的空向量/警告策略套到其他扩展，更不能据 async trait 声称其在途远程工作已经取消。

## S10：从引用、字节、尺寸到编码，再回到预算

**结论。** core 准备只处理 inline data URL；file 引用原样通过。上传失败回退已编码的 inline 内容；处理失败才进入占位文本分支。这些与本地 token 估算是不同步骤。

1. [模式选择](../../../codex/codex-rs/core/src/image_preparation.rs:45)：UnifiedImageBudget feature 且模型 Lite/可 original 才 UnifiedBudget，使用 ORIGINAL_DETAIL。DetailBased 的 None/Auto/High 走 HIGH_DETAIL，Original 走 ORIGINAL_DETAIL，Low 返回不支持错误。
2. [prepare_image](../../../codex/codex-rs/core/src/image_preparation.rs:342)：File 立即 Ok(None)；Inline 才 resize。HTTP(S) 错误，非 data/非 HTTP 的字符串 Ok(None) 保持原样；data URL 进入 helper。生产元数据记录原/新尺寸与 effective detail。upload 可回 Inline bytes 或 File id；upload Err 只 warn，回退编码后的 data URL，仍返回 resize 信息。Message/tool-output 的处理 Err 才由 [外层转换](../../../codex/codex-rs/core/src/image_preparation.rs:320) 替换为 placeholder；不把所有失败统一画成图片丢失。
3. **相邻 helper 的表示检查**：[load_data_url_for_prompt_with](../../../codex/codex-rs/utils/image/src/lib.rs:258) 检查大小写不敏感的 data:、逗号、base64 标记；编码 payload 与解码输入均有1GiB sanity guard，随后按内容 guess format，不凭 MIME 声明证明真实格式。该1GiB不是目标上传大小或模型预算。
4. **尺寸**：[HIGH_DETAIL/ORIGINAL_DETAIL](../../../codex/codex-rs/utils/image/src/lib.rs:75) 分别为最长边2048/6000、32px patches 上限2500/10000。[fit 与输出尺寸](../../../codex/codex-rs/utils/image/src/lib.rs:308) 先检查 `ceil(w/32)×ceil(h/32)` 与最长边；超限先按最长边比例 round、最小1，再按面积平方根缩放、把 patch-grid 向下修正、最后 floor。像素 resize 使用 Triangle。这里只证明公式/调用，不声称所有边缘图片已运行验证。
5. **格式与编码**：[load_for_prompt_bytes_uncached](../../../codex/codex-rs/utils/image/src/lib.rs:123) 读取 decoder 的 EXIF 与 RGB ICC（ICC bytes16..20 为 RGB），其他格式元数据不主动复制。无 resize 的 PNG/JPEG/WebP 可保留原字节；GIF/其他格式转 PNG。有 resize 时支持的 PNG/JPEG/WebP 保留格式，其余转 PNG。[encode_image](../../../codex/codex-rs/utils/image/src/lib.rs:363) 使用 PNG RGBA8、JPEG quality85、WebP lossless RGBA8；[metadata 设置](../../../codex/codex-rs/utils/image/src/lib.rs:426) 失败仍是编码 Err。这里不证明动画或第三方解码器内部行为。
6. **缓存与消费者**：[缓存](../../../codex/codex-rs/utils/image/src/lib.rs:102) key=输入字节 SHA1+mode，最多32 entries；[字节控制](../../../codex/codex-rs/utils/image/src/lib.rs:224) 总编码字节64MiB，超大项不缓存、超总额逐 LRU 淘汰。准备后的 envelope 分别进入 live history 与 original rollout，见 S4。Unified 模式 [保留 Original hint](../../../codex/codex-rs/core/src/image_preparation.rs:414) 供本地预算，Lite 发送层另去掉该兼容字段，见 S1。

本地 [estimate_original_image_bytes](../../../codex/codex-rs/core/src/context_manager/history.rs:1220) 解码 inline data URL，按32px grid计 patch、最多10000，再换为估算字节；解析失败回退7373字节估算。[File 引用](../../../codex/codex-rs/core/src/context_manager/history.rs:1268) 没尺寸：Original 用最大10000patch，否则7373字节。约4bytes/token的换算是本 commit heuristic；上传成功改成 File 后，不可再凭 URL 原尺寸断言估算仍精确。服务端实际收费未验证。

## 设计分析与剩余边界

**源码事实：** 扩展 gate/贡献类型/存储层分开；图片处理、上传回退与估算分别有消费者。

**解释推断：** typed sections 能在配置变化后以较小更新纠正模型状态；保留原媒体字节与元数据便于恢复重处理；上传失败退回 inline 提高可用性。这些不是维护者意图或收益测量证明。

**替代方案：** 所有扩展统一输出消息可集中预算，但容易混淆能力声明与内容输入；每次都重编码图片可统一格式，却增加计算与质量损耗；用上传后尺寸 sidecar 计数可降低 File 最大值估算的保守度，需要保证元数据生命周期一致。

本轮已补齐安装扩展的上述 gate、贡献和消费边界，以及直接图片 helper 的尺寸/编码主分支。剩余为各远程/provider 的实际结果、异步竞态、全部 feature 组合和图片边缘输入的运行证据；第三方 codec、selector 与审批算法保持原题接口边界。没有提出必需的新 LSP 查询。
