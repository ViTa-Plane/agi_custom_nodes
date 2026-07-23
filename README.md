<div align="center">

<h1>AGI Custom Nodes for ComfyUI</h1>

<p>
 A collection of custom ComfyUI nodes used in my personal workflows. Tested on ComfyUI 0.22.0 with ComfyUI_frontend v1.43.18.
</p>

<p>
  <a href="#-node-categories">Node Categories</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-license">License</a>
</p>

</div>

<hr />

<h2>Usage:</h2>
<p>in ComfyUI  interface right click --> add node --> agi/</p>

<h2>Node Categories</h2>

<details open>
  <summary><b><code>agi/string</code> — Text &amp; String Utilities</b></summary>
  <p>Nodes for manipulating, formatting, and dynamically parsing text prompts and strings.</p>
  <ul>
    <li><b>String Composer</b> (<code>StringComposer.py</code>) – Dynamic string templating and composition.</li>
    <li><b>String Splitter</b> (<code>StringSplitter.py</code>) – Splits text inputs using customizable delimiters.</li>
    <li><b>String Concatenate</b> (<code>string_concatenate.py</code>) – Combines multiple string inputs into a single output.</li>
    <li><b>String Cleaner</b> (<code>string_cleaner_node.py</code>) – Sanitizes and cleans string inputs.</li>
    <li><b>String Uncomment</b> (<code>string_uncomment_node.py</code>) – Filters out commented lines from prompt strings.</li>
    <li><b>Line Reader</b> (<code>line_reader.py</code> / <code>line_reader.js</code>) – Reads text line-by-line across generations.</li>
  </ul>
</details>

<details open>
  <summary><b><code>agi/latent</code> — Latent &amp; Resolution Generators</b></summary>
  <p>Nodes designed for generating empty latents based on predefined SDXL aspect ratios and resolution presets.</p>
  <ul>
    <li><b>SDXL Empty Latent</b> (<code>sdxl_empty_latent.py</code>) – Generates empty latents targeting standard SDXL resolutions. Reads resolutions from sdxl_resolutions.json.</li>
    <li><b>Random Resolution Latent</b> (<code>RndResLatent.py</code>) – Outputs latents with randomized resolution presets (832x1216), (1216x832) and (1024x1024) (hard coded, change if you need). The node outputs W and H  dimensions as Int ,latent image and resolution string in (W)x(H) format</li>
  </ul>
</details>

<details open>
  <summary><b><code>agi/images</code> — image tools </b></summary>
  <p>Nodes designed for image monipulations</p>
  <ul>
    <li><b>SDXL Resolution Selector</b> (<code>sdxl_resolutions.py</code>) – Utility for managing SDXL aspect ratios and dimensions. Reads resolutions from  sdxl_resolutions.json.</li>
  </ul>
</details>

<details open>
  <summary><b><code>agi/mask</code> — Interactive Masking</b></summary>
  <p>Interactive masking tools integrated directly into the ComfyUI canvas interface.</p>
  <ul>
    <li><b>Interactive Mask</b> (<code>interactive_mask.py</code> / <code>interactive_mask.js</code>) – Canvas-based interactive mask editor.</li>
    <li><b>Interactive Mask Lite</b> (<code>interactive_mask_lite.py</code> / <code>interactive_mask_lite.js</code>) – Lightweight canvas masking tool.</li>
  </ul>
</details>

<details open>
  <summary><b><code>agi/logic</code> — Logic &amp; Workflow Control</b></summary>
  <p>Flow-control nodes for iteration, timing, and execution management.</p>
  <ul>
    <li><b>Auto Break</b> (<code>auto_break.py</code>) – automaticly inserts a BREAK every 75 tokens (change in max_tokens widget). Text output with BREAK commands and total tokens count outputs. For use  with ComfyUI's "CLIPTextEncode with BREAK syntax" node.</li>
    <li><b>Timeout Node</b> (<code>timeout_node.py</code>) – Sets maximum execution limits to prevent hanging operations.</li>
    <li><b>Integer Incrementer</b> (<code>IntIncrementer.py</code> / <code>int_incrementer.js</code>) – Step/counter node for loops and seed management.</li>
  </ul>
</details>

<details open>
  <summary><b><code>agi/utils</code> — Workflow Introspection</b></summary>
  <p>Helper utilities to extract metadata and widget values across the graph.</p>
  <ul>
    <li><b>Get KSampler Info</b> (<code>GetKSamplerInfo.py</code>) – Extracts sampler configurations (steps, cfg, sampler, seed).</li>
    <li><b>Get Widget Value</b> (<code>get_widget_value.py</code>) – Reads widget values directly from target nodes.</li>
  </ul>
</details>

<hr />

<h2>Installation</h2>
<ol>
  <li>Open your terminal or command prompt and navigate to your custom nodes directory:
    <pre><code>cd ComfyUI/custom_nodes/</code></pre>
  </li>
  <li>Clone this repository:
    <pre><code>git clone https://github.com/ViTa-Plane/agi_custom_nodes.git</code></pre>
  </li>
  <li>Restart ComfyUI.</li>
</ol>

<hr />

<h2>License</h2>
<p>
  This project is licensed under the <a href="LICENSE">MIT License</a>.
</p>


