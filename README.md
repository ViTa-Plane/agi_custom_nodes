<div align="center">

<h1>AGI Custom Nodes for ComfyUI</h1>

<p>
  A collection of custom ComfyUI nodes used in my personal workflows. Tested on ComfyUI 0.22.0 with ComfyUI_frontend v1.43.18.
</p>

<p>
  <a href="#usage">Usage</a> •
  <a href="#node-categories">Node Categories</a> •
  <a href="#installation">Installation</a> •
  <a href="#license">License</a>
</p>

</div>

<hr />

<h2 id="usage">Usage</h2>
<p>In the ComfyUI interface: <b> right-click &rarr; Add Node</b> &rarr; <b>agi </b></p>

<hr />

<h2 id="node-categories">Node Categories</h2>

<details open>
  <summary><b><code>agi/string</code> — Text &amp; String Utilities</b></summary>
  <p>Nodes for manipulating, formatting, and dynamically parsing text prompts and strings.</p>
  <ul>
    <li><b>String Composer (Pre/App)</b> (<code>StringComposer.py</code>) – String templating and composition with prepend, append and separator.</li>
    <li><b>String Splitter</b> (<code>StringSplitter.py</code>) – Splits text inputs using customizable delimiters.</li>
    <li><b>Dynamic String Concatenate</b> (<code>string_concatenate.py</code>) – Combines multiple string inputs into a single output.Uses <a href="https://github.com/cozy-comfyui/cozy_ex_dynamic"> Dynamic Inputs for ComfyUI</a> method .</li>
    <li><b>String Cleaner</b> (<code>string_cleaner_node.py</code>) – Sanitizes and cleans string inputs.</li>
    <li><b>String Uncomment</b> (<code>string_uncomment_node.py</code>) – Filters out commented lines from prompt strings.</li>
    <li><b>Line Reader</b> (<code>line_reader.py</code> / <code>line_reader.js</code>) – Reads text line-by-line across generations.</li>
  </ul>
</details>

<details open>
  <summary><b><code>agi/latent</code> — Latent &amp; Resolution Generators</b></summary>
  <p>Nodes designed for generating empty latents based on predefined SDXL aspect ratios and resolution presets.</p>
  <ul>
    <li><b>SDXL Empty Latent</b> (<code>sdxl_empty_latent.py</code>) – Generates empty latents targeting standard SDXL resolutions. Reads resolutions from <code>sdxl_resolutions.json</code>.</li>
    <li><b>Random Resolution Latent</b> (<code>RndResLatent.py</code>) – Outputs latents with randomized SDXL resolution presets: <code>832x1216</code>, <code>1216x832</code>, and <code>1024x1024</code> (hardcoded; modify source if needed). Outputs width (W) and height (H) dimensions as integers, latent image, and resolution string in <code>(W)x(H)</code> format.</li>
  </ul>
</details>

<details open>
  <summary><b><code>agi/images</code> — Image Tools</b></summary>
  <p>Nodes designed for image manipulations.</p>
  <ul>
    <li><b>SDXL Resolution Selector</b> (<code>sdxl_resolutions.py</code>) – Utility for managing SDXL aspect ratios and dimensions. Reads resolutions from <code>sdxl_resolutions.json</code>.</li>
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
    <li><b>Auto Break</b> (<code>auto_break.py</code>) – Automatically inserts a <code>BREAK</code> statement every 75 tokens (configurable via the <code>max_tokens</code> widget). Outputs text with <code>BREAK</code> commands and total token counts. Intended for use with ComfyUI's "CLIPTextEncode with BREAK syntax" node.</li>
    <li><b>Timeout Node</b> (<code>timeout_node.py</code>) – A debug tool.Generates delay in ms and a random integer</li>
    <li><b>Integer Incrementer</b> (<code>IntIncrementer.py</code> / <code>int_incrementer.js</code>) – Step/counter node for loops and seed management.</li>
  </ul>
</details>

<details open>
  <summary><b><code>agi/utils</code> — Workflow Helper utilities</b></summary>
  <p>Helper utilities to extract metadata and widget values across the graph.Tools need node ID, enable in ComfyUI settings › Lite Graph › Node › Node ID badge mode › Show All</p>
  <ul>
    <li><b>Get KSampler Info</b> (<code>GetKSamplerInfo.py</code>) – Extracts sampler configurations (steps, CFG, sampler name, seed).You need to provide your workflow's KSampler node ID</li>
    <li><b>Get Widget Value</b> (<code>get_widget_value.py</code>) – Reads widget values directly from target nodes selected by their node ID.</li>
  </ul>
</details>

<hr />

<h2 id="installation">Installation</h2>
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

<h2 id="license">License</h2>
<p>
  This project is licensed under the <a href="LICENSE">GNU General Public License (GPL)</a>.
</p>


