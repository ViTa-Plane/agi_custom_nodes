/**
 * ===============================================================================
 * Extension: Easy Character Selector
 * File: easy_character_selector.js
 * Version: 2.7.2
 * Description: Frontend canvas UI extension for 'Easy Character Selector' node.
 * ===============================================================================
 */
import { app } from "/scripts/app.js";

app.registerExtension({
    name: "agi.CharacterSelectorV2.Extension",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "CharacterSelectorV2") {

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (onNodeCreated) onNodeCreated.apply(this, arguments);

                const node = this;
                node.previewImage = null;
                node.previewImageLoaded = false;
                node.debugStatus = "Initializing...";
                node.attemptedPath = "";
                node.activeThumbnailFile = "";
                node.expectedThumbnailFile = "";

                node.currentStyleName = "None";
                node.currentPositiveText = "";
                node.currentNegativeText = "";
                node.currentCharacterText = "misc";
                node.detectedLoraNames = [];

                node.currentCommentText = "";
                node.currentSeedValue = "None";
                node.currentSourceFile = "None";
                node.seedCopyFeedback = false;

                node.isHoveringThumb = false;
                node.mousePos = [0, 0];

                let thumbnailWidget = node.widgets?.find(w => w.name === "thumbnail");
                if (!thumbnailWidget) {
                    thumbnailWidget = node.addWidget("text", "thumbnail", "", () => {}, { serialize: true });
                }

                thumbnailWidget.type = "converted-widget";
                thumbnailWidget.hidden = true;
                thumbnailWidget.computeSize = () => [0, -4];
                thumbnailWidget.draw = function() {};

                const processFrontendLoraWeights = (text, weightVal) => {
                    if (!text) return "";
                    return text.replace(/<lora:([^>]+)>/g, (match, innerContent) => {
                        if (innerContent.includes("{weight}")) {
                            const formattedWeight = weightVal.toFixed(2);
                            const replacedContent = innerContent.replace(/{weight}/g, formattedWeight);
                            const parts = replacedContent.split(":");
                            const processedParts = [parts[0]];
                            const origParts = innerContent.split(":");

                            for (let idx = 1; idx < parts.length; idx++) {
                                if (idx < origParts.length && origParts[idx] === "{weight}") {
                                    processedParts.push(parts[idx]);
                                } else {
                                    const num = parseFloat(parts[idx]);
                                    processedParts.push(!isNaN(num) ? (num * weightVal).toFixed(2) : parts[idx]);
                                }
                            }
                            return `<lora:${processedParts.join(":")}>`;
                        }

                        const parts = innerContent.split(":");
                        if (parts.length >= 2) {
                            const processedParts = [parts[0]];
                            for (let idx = 1; idx < parts.length; idx++) {
                                const num = parseFloat(parts[idx]);
                                processedParts.push(!isNaN(num) ? (num * weightVal).toFixed(2) : parts[idx]);
                            }
                            return `<lora:${processedParts.join(":")}>`;
                        }

                        return match;
                    });
                };

                const updateComboValues = (widget, newValues, preferredDefault = null) => {
                    if (!widget) return;
                    widget.options = widget.options || {};
                    widget.options.values = newValues;

                    const defaultToUse = (preferredDefault && newValues.includes(preferredDefault))
                        ? preferredDefault
                        : (newValues[0] || "default");

                    if (!newValues.includes(widget.value)) {
                        widget.value = defaultToUse;
                    }
                };

                function syncStylesData() {
                    let stylesArray = [];
                    try {
                        const hiddenWidget = node.widgets?.find(w => w.name === "styles_inventory");
                        let rawVal = hiddenWidget ? hiddenWidget.value : null;

                        if (!rawVal && nodeData.input?.hidden?.styles_inventory) {
                            rawVal = nodeData.input.hidden.styles_inventory[1]?.default;
                        }

                        if (rawVal) {
                            stylesArray = typeof rawVal === "string" ? JSON.parse(rawVal) : rawVal;
                        }
                    } catch(e) {
                        console.error("[Easy Character Selector Sync Error]", e);
                    }

                    if (!Array.isArray(stylesArray)) stylesArray = [];

                    stylesArray = stylesArray.filter(item => item && item.category && String(item.category).toLowerCase() === "character");

                    const characterWidget = node.widgets?.find(w => w.name === "select_character");
                    const epochWidget = node.widgets?.find(w => w.name === "epoch");
                    const versionWidget = node.widgets?.find(w => w.name === "version");
                    const ageWidget = node.widgets?.find(w => w.name === "age");
                    const clothesWidget = node.widgets?.find(w => w.name === "clothing" || w.name === "clothing/mod" || w.name === "modifier (optional)");
                    const modWidget = node.widgets?.find(w => w.name === "mod");
                    const conceptWidget = node.widgets?.find(w => w.name === "concept");
                    const wrapBreakWidget = node.widgets?.find(w => w.name === "wrap_break");
                    const loraStrengthWidget = node.widgets?.find(w => w.name === "lora_strength");
                    const keywordStrengthWidget = node.widgets?.find(w => w.name === "keyword_strength");

                    if (!characterWidget) return;

                    const validNames = stylesArray.map(item => item.name);
                    updateComboValues(characterWidget, validNames.length > 0 ? validNames : ["None"], "None");

                    const updateCanvasThumbnail = () => {
                        if (!stylesArray || stylesArray.length === 0) return;

                        const selectedValue = characterWidget.value;
                        node.currentStyleName = selectedValue;
                        const styleConfig = stylesArray.find(item => item.name === selectedValue);

                        if (!styleConfig) {
                            node.previewImage = null;
                            node.previewImageLoaded = false;
                            node.activeThumbnailFile = "";
                            node.expectedThumbnailFile = "";
                            if (thumbnailWidget) thumbnailWidget.value = "";
                            node.currentPositiveText = "";
                            node.currentNegativeText = "";
                            node.currentCharacterText = "misc";
                            node.currentCommentText = "";
                            node.currentSeedValue = "None";
                            node.currentSourceFile = "None";
                            node.detectedLoraNames = [];

                            updateComboValues(versionWidget, ["default"], "default");
                            updateComboValues(clothesWidget, ["none"], "none");

                            if (modWidget) {
                                updateComboValues(modWidget, ["none"], "none");
                                modWidget.type = "converted-widget";
                                modWidget.hidden = true;
                                modWidget.computeSize = () => [0, -4];
                            }
                            if (ageWidget) {
                                updateComboValues(ageWidget, ["none"], "none");
                                ageWidget.type = "converted-widget";
                                ageWidget.hidden = true;
                                ageWidget.computeSize = () => [0, -4];
                            }
                            if (conceptWidget) {
                                updateComboValues(conceptWidget, ["none"], "none");
                                conceptWidget.type = "converted-widget";
                                conceptWidget.hidden = true;
                                conceptWidget.computeSize = () => [0, -4];
                            }
                            if (epochWidget) {
                                epochWidget.type = "converted-widget";
                                epochWidget.hidden = true;
                                epochWidget.computeSize = () => [0, -4];
                            }
                            node.setSize(node.computeSize());
                            app.canvas.setDirty(true, true);
                            return;
                        }

                        if (versionWidget) {
                            let availableVersions = ["default"];
                            if (styleConfig.version && typeof styleConfig.version === "object") {
                                const keys = Object.keys(styleConfig.version).filter(k => k !== "default");
                                availableVersions = ["default", ...keys];
                            }
                            updateComboValues(versionWidget, availableVersions, "default");
                        }

                        const hasAgeProperty = (styleConfig.age && Object.keys(styleConfig.age).length > 0);

                        if (ageWidget) {
                            let availableAges = ["none"];
                            if (styleConfig.age && typeof styleConfig.age === "object") {
                                const keys = Object.keys(styleConfig.age);
                                if (keys.length > 0) {
                                    availableAges = Array.from(new Set(["none", ...keys]));
                                }
                            }
                            updateComboValues(ageWidget, availableAges, "none");

                            if (hasAgeProperty) {
                                ageWidget.type = "combo";
                                ageWidget.hidden = false;
                                delete ageWidget.computeSize;
                            } else {
                                ageWidget.type = "converted-widget";
                                ageWidget.hidden = true;
                                ageWidget.computeSize = () => [0, -4];
                            }
                        }

                        const hasModProperty = (styleConfig.mod && Object.keys(styleConfig.mod).length > 0);

                        if (modWidget) {
                            let availableMods = ["none"];
                            if (styleConfig.mod && typeof styleConfig.mod === "object") {
                                const keys = Object.keys(styleConfig.mod);
                                if (keys.length > 0) {
                                    availableMods = Array.from(new Set(["none", ...keys]));
                                }
                            }
                            updateComboValues(modWidget, availableMods, "none");

                            if (hasModProperty) {
                                modWidget.type = "combo";
                                modWidget.hidden = false;
                                delete modWidget.computeSize;
                            } else {
                                modWidget.type = "converted-widget";
                                modWidget.hidden = true;
                                modWidget.computeSize = () => [0, -4];
                            }
                        }

                        if (conceptWidget) {
                            let availableConcepts = ["none"];
                            if (styleConfig.concept && typeof styleConfig.concept === "object") {
                                const keys = Object.keys(styleConfig.concept);
                                if (keys.length > 0) {
                                    availableConcepts = Array.from(new Set(["none", ...keys]));
                                }
                            }
                            updateComboValues(conceptWidget, availableConcepts, "none");

                            const hasConceptPlaceholder = (
                                (styleConfig.prompt && styleConfig.prompt.includes("{concept}")) ||
                                (styleConfig.version && Object.values(styleConfig.version).some(v => typeof v === "string" && v.includes("{concept}"))) ||
                                (styleConfig.concept && Object.keys(styleConfig.concept).length > 0)
                            );

                            if (hasConceptPlaceholder) {
                                conceptWidget.type = "combo";
                                conceptWidget.hidden = false;
                                delete conceptWidget.computeSize;
                            } else {
                                conceptWidget.type = "converted-widget";
                                conceptWidget.hidden = true;
                                conceptWidget.computeSize = () => [0, -4];
                            }
                        }

                        if (clothesWidget) {
                            let availableClothes = ["none"];
                            if (styleConfig.clothes && typeof styleConfig.clothes === "object") {
                                const keys = Object.keys(styleConfig.clothes);
                                if (keys.length > 0) {
                                    availableClothes = Array.from(new Set(["none", ...keys]));
                                }
                            }
                            updateComboValues(clothesWidget, availableClothes, "none");
                        }

                        const selectedVersionKey = versionWidget ? versionWidget.value : "default";
                        let targetPromptTemplate = styleConfig.prompt || "";
                        if (styleConfig.version && typeof styleConfig.version === "object") {
                            targetPromptTemplate = styleConfig.version[selectedVersionKey] || styleConfig.version["default"] || targetPromptTemplate;
                        }

                        const selectedAgeKey = ageWidget ? ageWidget.value : "none";
                        let ageText = "";
                        if (selectedAgeKey && selectedAgeKey !== "none" && styleConfig.age) {
                            ageText = styleConfig.age[selectedAgeKey] || "";
                        }

                        const selectedConceptKey = conceptWidget ? conceptWidget.value : "none";
                        let conceptText = "";
                        if (selectedConceptKey && selectedConceptKey !== "none" && styleConfig.concept) {
                            conceptText = styleConfig.concept[selectedConceptKey] || "";
                        }

                        const selectedClothesKey = clothesWidget ? clothesWidget.value : "none";
                        let clothesText = "";
                        if (selectedClothesKey && selectedClothesKey !== "none" && styleConfig.clothes) {
                            clothesText = styleConfig.clothes[selectedClothesKey] || "";
                        }

                        const selectedModKey = modWidget ? modWidget.value : "none";
                        let modText = "";
                        if (selectedModKey && selectedModKey !== "none" && styleConfig.mod) {
                            modText = styleConfig.mod[selectedModKey] || "";
                        }

                        let loraText = "";
                        if (styleConfig.lora && typeof styleConfig.lora === "object") {
                            if (styleConfig.lora[selectedVersionKey]) {
                                loraText = styleConfig.lora[selectedVersionKey];
                            } else if (styleConfig.lora["default"]) {
                                loraText = styleConfig.lora["default"];
                            } else {
                                const loraVals = Object.values(styleConfig.lora);
                                if (loraVals.length > 0) loraText = loraVals[0];
                            }
                        }

                        const hasEpochPlaceholder = (
                            (targetPromptTemplate && targetPromptTemplate.includes("{epoch}")) ||
                            (clothesText && clothesText.includes("{epoch}")) ||
                            (modText && modText.includes("{epoch}")) ||
                            (loraText && loraText.includes("{epoch}")) ||
                            (ageText && ageText.includes("{epoch}"))
                        );

                        if (epochWidget) {
                            if (hasEpochPlaceholder) {
                                epochWidget.type = "number";
                                epochWidget.hidden = false;
                                delete epochWidget.computeSize;
                            } else {
                                epochWidget.type = "converted-widget";
                                epochWidget.hidden = true;
                                epochWidget.computeSize = () => [0, -4];
                            }
                        }

                        const rawEpoch = epochWidget ? (epochWidget.value || 1) : 1;
                        const activeEpochVal = String(Math.floor(rawEpoch)).padStart(2, '0');

                        if (loraText && loraText.includes("{epoch}")) {
                            loraText = loraText.replace(/{epoch}/g, activeEpochVal);
                        }
                        if (ageText && ageText.includes("{epoch}")) {
                            ageText = ageText.replace(/{epoch}/g, activeEpochVal);
                        }

                        const loraStrengthVal = loraStrengthWidget ? (parseFloat(loraStrengthWidget.value) || 1.0) : 1.0;
                        const kwStrengthVal = keywordStrengthWidget ? (parseFloat(keywordStrengthWidget.value) || 1.0) : 1.0;
                        const kwValStr = (kwStrengthVal % 1 !== 0) ? kwStrengthVal.toFixed(2).replace(/\.?0+$/, '') : String(Math.floor(kwStrengthVal));

                        const cleanUIString = (str, isPositive = true) => {
                            if (!str) return "";
                            let cleaned = str.replace(/{prompt}/g, "").replace(/{kw_str}/g, kwValStr).replace(/{epoch}/g, activeEpochVal);

                            const hasConceptPlaceholder = str.includes("{concept}");
                            if (hasConceptPlaceholder && isPositive) {
                                cleaned = cleaned.replace(/{concept}/g, conceptText);
                            }

                            const hasClothesPlaceholder = str.includes("{clothes}");
                            if (hasClothesPlaceholder && isPositive) {
                                cleaned = cleaned.replace(/{clothes}/g, clothesText);
                            }

                            const hasModPlaceholder = str.includes("{mod}");
                            if (hasModPlaceholder && isPositive) {
                                cleaned = cleaned.replace(/{mod}/g, modText);
                            }

                            const hasLoraPlaceholder = str.includes("{lora}");
                            if (hasLoraPlaceholder && isPositive) {
                                cleaned = cleaned.replace(/{lora}/g, loraText);
                            }

                            const hasAgePlaceholder = str.includes("{age}");
                            if (hasAgePlaceholder && isPositive) {
                                cleaned = cleaned.replace(/{age}/g, ageText);
                            }

                            cleaned = processFrontendLoraWeights(cleaned, loraStrengthVal);
                            cleaned = cleaned.replace(/,(?:\s*,)+/g, ",");
                            cleaned = cleaned.trim().replace(/^,|,$/g, "").trim();

                            if (isPositive && str === targetPromptTemplate) {
                                const addParts = [];
                                if (ageText && !hasAgePlaceholder) addParts.push(ageText);
                                if (clothesText && !hasClothesPlaceholder) addParts.push(clothesText);
                                if (modText && !hasModPlaceholder) addParts.push(modText);
                                if (loraText && !hasLoraPlaceholder) addParts.push(loraText);
                                if (conceptText && !hasConceptPlaceholder) addParts.push(conceptText);
                                if (addParts.length > 0) {
                                    const joined = addParts.join(", ");
                                    cleaned = cleaned ? `${cleaned}, ${joined}` : joined;
                                }
                            }
                            return cleaned;
                        };

                        let basePositive = cleanUIString(targetPromptTemplate, true);

                        node.currentPositiveText = basePositive;
                        node.currentNegativeText = cleanUIString(styleConfig.negative_prompt, false);
                        node.currentCharacterText = styleConfig.character || "misc";
                        node.currentSourceFile = styleConfig.file_name || "Unknown.json";

                        let formattedParams = "";
                        if (styleConfig.params && typeof styleConfig.params === 'object') {
                            const p = styleConfig.params;
                            let parts = [];
                            Object.entries(p).forEach(([key, value]) => {
                                if (key !== "seed" && value !== undefined && value !== null) {
                                    parts.push(`${key}:${value}`);
                                }
                            });
                            formattedParams = parts.join(",");
                        }

                        let targetSeed = styleConfig.seed;
                        if (targetSeed === undefined || targetSeed === null || targetSeed === "") {
                            targetSeed = styleConfig.params?.seed;
                        }
                        node.currentSeedValue = (targetSeed !== undefined && targetSeed !== null && targetSeed !== "") ? String(targetSeed) : "None";

                        node.detectedLoraNames = [];
                        const rawCombinedText = `${targetPromptTemplate} ${ageText} ${clothesText} ${modText} ${loraText} ${styleConfig.negative_prompt || ""}`;
                        const processedCombinedText = rawCombinedText
                            .replace(/{epoch}/g, activeEpochVal)
                            .replace(/{kw_str}/g, kwValStr)
                            .replace(/{concept}/g, conceptText)
                            .replace(/{clothes}/g, clothesText)
                            .replace(/{mod}/g, modText)
                            .replace(/{lora}/g, loraText)
                            .replace(/{age}/g, ageText);

                        const loraRegex = /<lora:([^:]+)(?::[^>]+)?>/g;
                        const embedRegex = /[^a-zA-Z0-9_-]?embedding:([a-zA-Z0-9_.-]+)/g;
                        let match;
                        const uniqueDeps = new Set();

                        while ((match = loraRegex.exec(processedCombinedText)) !== null) {
                            if (match[1]) {
                                const entry = `LoRa: ${match[1].trim()}`;
                                if (!uniqueDeps.has(entry)) {
                                    uniqueDeps.add(entry);
                                    node.detectedLoraNames.push({ type: "lora", text: entry });
                                }
                            }
                        }
                        while ((match = embedRegex.exec(processedCombinedText)) !== null) {
                            if (match[1]) {
                                const entry = `Emb: ${match[1].trim()}`;
                                if (!uniqueDeps.has(entry)) {
                                    uniqueDeps.add(entry);
                                    node.detectedLoraNames.push({ type: "embed", text: entry });
                                }
                            }
                        }

                        if (styleConfig.name && styleConfig.name.includes("⚠️ ERROR IN")) {
                            node.previewImage = null;
                            node.previewImageLoaded = false;
                            node.activeThumbnailFile = "";
                            node.expectedThumbnailFile = "";
                            if (thumbnailWidget) thumbnailWidget.value = "";
                            node.debugStatus = "JSON Syntax Error Block";
                            node.attemptedPath = "";
                            node.currentCommentText = styleConfig.comment || "None";
                            node.setSize(node.computeSize());
                            app.canvas.setDirty(true, true);
                            return;
                        }

                        const tryNoneFallback = (attemptedFileName) => {
                            const nonePath = `/agi_characters_thumbnails/none.png`;
                            const noneImg = new Image();
                            noneImg.src = `${nonePath}?t=${Date.now()}`;
                            noneImg.onload = () => {
                                node.previewImage = noneImg;
                                node.previewImageLoaded = true;
                                node.activeThumbnailFile = "none.png (Fallback)";
                                let baseComment = styleConfig.comment || "";
                                node.currentCommentText = formattedParams
                                    ? (baseComment ? `${baseComment}|${formattedParams}` : formattedParams)
                                    : (baseComment || "None");
                                app.canvas.setDirty(true, true);
                            };
                            noneImg.onerror = () => {
                                node.previewImage = null;
                                node.previewImageLoaded = false;
                                node.activeThumbnailFile = "None (404 Missing)";
                                node.debugStatus = "Image 404 Missing";
                                node.currentCommentText = `[ERR: Missing Thumbnail File] Place image here: character_packs/thumbnails/${attemptedFileName || "none.png"}`;
                                app.canvas.setDirty(true, true);
                            };
                        };

                        if (styleConfig.thumbnail) {
                            const baseThumb = styleConfig.thumbnail;

                            let cleanVer = "";
                            if (selectedVersionKey && selectedVersionKey !== "default") {
                                cleanVer = selectedVersionKey
                                    .replace(/\(default\)/gi, "")
                                    .replace(/default/gi, "")
                                    .trim()
                                    .toLowerCase()
                                    .replace(/\s+/g, '_');
                            }

                            const cleanAge = (selectedAgeKey && selectedAgeKey !== "none")
                                ? selectedAgeKey.toLowerCase().replace(/\s+/g, '_')
                                : "";

                            const cleanClothes = (selectedClothesKey && selectedClothesKey !== "none")
                                ? selectedClothesKey.toLowerCase().replace(/\s+/g, '_')
                                : "";

                            const cleanMod = (selectedModKey && selectedModKey !== "none")
                                ? selectedModKey.toLowerCase().replace(/\s+/g, '_')
                                : "";

                            const cleanConcept = (selectedConceptKey && selectedConceptKey !== "none")
                                ? selectedConceptKey.toLowerCase().replace(/\s+/g, '_')
                                : "";

                            const cleanEpochStr = hasEpochPlaceholder ? `epoch${activeEpochVal}` : "";

                            let baseName = baseThumb;
                            let ext = "";
                            const lastDotIdx = baseThumb.lastIndexOf(".");
                            if (lastDotIdx !== -1) {
                                baseName = baseThumb.substring(0, lastDotIdx);
                                ext = baseThumb.substring(lastDotIdx);
                            }

                            const rawCandidates = [];

                            const epochOptions = cleanEpochStr ? [cleanEpochStr, ""] : [""];
                            const versionOptions = cleanVer ? [cleanVer, ""] : [""];
                            const ageOptions = cleanAge ? [cleanAge, ""] : [""];

                            for (const e of epochOptions) {
                                for (const v of versionOptions) {
                                    for (const a of ageOptions) {
                                        if (cleanClothes && cleanMod && cleanConcept && a) {
                                            rawCandidates.push(`${[baseName, e, v, cleanClothes, cleanMod, cleanConcept, a].filter(Boolean).join("_")}${ext}`);
                                        }
                                        if (cleanClothes && cleanMod && a) {
                                            rawCandidates.push(`${[baseName, e, v, cleanClothes, cleanMod, a].filter(Boolean).join("_")}${ext}`);
                                        }
                                        if (cleanClothes && a) {
                                            rawCandidates.push(`${[baseName, e, v, cleanClothes, a].filter(Boolean).join("_")}${ext}`);
                                        }
                                        if (cleanMod && cleanConcept && a) {
                                            rawCandidates.push(`${[baseName, e, v, cleanMod, cleanConcept, a].filter(Boolean).join("_")}${ext}`);
                                        }
                                        if (cleanMod && a) {
                                            rawCandidates.push(`${[baseName, e, v, cleanMod, a].filter(Boolean).join("_")}${ext}`);
                                        }

                                        if (cleanClothes && cleanMod && cleanConcept) {
                                            rawCandidates.push(`${[baseName, e, v, cleanClothes, cleanMod, cleanConcept].filter(Boolean).join("_")}${ext}`);
                                        }
                                        if (cleanClothes && cleanMod) {
                                            rawCandidates.push(`${[baseName, e, v, cleanClothes, cleanMod].filter(Boolean).join("_")}${ext}`);
                                        }
                                        if (cleanClothes) {
                                            rawCandidates.push(`${[baseName, e, v, cleanClothes].filter(Boolean).join("_")}${ext}`);
                                        }
                                        if (cleanMod) {
                                            rawCandidates.push(`${[baseName, e, v, cleanMod].filter(Boolean).join("_")}${ext}`);
                                        }
                                        if (cleanConcept) {
                                            rawCandidates.push(`${[baseName, e, v, cleanConcept].filter(Boolean).join("_")}${ext}`);
                                        }

                                        if (a) {
                                            rawCandidates.push(`${[baseName, e, v, a].filter(Boolean).join("_")}${ext}`);
                                        }

                                        const pBase = [baseName, e, v].filter(Boolean);
                                        if (pBase.length > 1 || pBase[0] !== baseName) {
                                            rawCandidates.push(`${pBase.join("_")}${ext}`);
                                        }
                                    }
                                }
                            }

                            rawCandidates.push(baseThumb);

                            const uniqueCandidates = [...new Set(rawCandidates)];
                            node.expectedThumbnailFile = uniqueCandidates[0];

                            if (thumbnailWidget) {
                                thumbnailWidget.value = node.expectedThumbnailFile;
                            }

                            const loadThumbnailCascade = (index) => {
                                if (index >= uniqueCandidates.length) {
                                    tryNoneFallback(uniqueCandidates[0]);
                                    return;
                                }

                                const targetFile = uniqueCandidates[index];
                                const primaryPath = `/agi_characters_thumbnails/${targetFile}`;
                                node.attemptedPath = primaryPath;

                                const img = new Image();
                                img.src = `${primaryPath}?t=${Date.now()}`;

                                img.onload = () => {
                                    node.previewImage = img;
                                    node.previewImageLoaded = true;
                                    node.activeThumbnailFile = targetFile;

                                    let baseComment = styleConfig.comment || "";
                                    node.currentCommentText = formattedParams
                                        ? (baseComment ? `${baseComment}|${formattedParams}` : formattedParams)
                                        : (baseComment || "None");
                                    app.canvas.setDirty(true, true);
                                };

                                img.onerror = () => {
                                    loadThumbnailCascade(index + 1);
                                };
                            };

                            loadThumbnailCascade(0);
                        } else {
                            node.expectedThumbnailFile = "none.png";
                            if (thumbnailWidget) thumbnailWidget.value = "none.png";
                            tryNoneFallback("none.png");
                        }

                        node.setSize(node.computeSize());
                    };

                    const assignWidgetCallback = (widget) => {
                        if (!widget) return;
                        widget.callback = function(val) {
                            widget.value = val;
                            updateCanvasThumbnail();
                            app.canvas.setDirty(true, true);
                        };
                    };

                    assignWidgetCallback(characterWidget);
                    assignWidgetCallback(epochWidget);
                    assignWidgetCallback(versionWidget);
                    assignWidgetCallback(ageWidget);
                    assignWidgetCallback(clothesWidget);
                    assignWidgetCallback(modWidget);
                    assignWidgetCallback(conceptWidget);
                    assignWidgetCallback(wrapBreakWidget);
                    assignWidgetCallback(loraStrengthWidget);
                    assignWidgetCallback(keywordStrengthWidget);

                    updateCanvasThumbnail();
                }

                setTimeout(syncStylesData, 50);
                setTimeout(syncStylesData, 300);
            };

            nodeType.prototype.getCanvasWidgetsHeight = function() {
                let totalWidgetHeight = 0;
                if (this.widgets) {
                    for (const w of this.widgets) {
                        if (w.type === "converted-widget" || w.hidden) continue;
                        totalWidgetHeight += w.computeSize ? w.computeSize()[1] : 26;
                    }
                }
                return Math.max(180, totalWidgetHeight + 50);
            };

            nodeType.prototype.onMouseMove = function (e, local_pos) {
                const widgetsHeight = this.getCanvasWidgetsHeight();
                const startY = widgetsHeight + 35;
                const padding = 14;
                const thumbSize = 110;

                const wasHovering = this.isHoveringThumb;
                this.mousePos = local_pos;

                if (local_pos[0] >= padding && local_pos[0] <= padding + thumbSize &&
                    local_pos[1] >= startY && local_pos[1] <= startY + thumbSize) {
                    this.isHoveringThumb = true;
                } else {
                    this.isHoveringThumb = false;
                }

                if (wasHovering !== this.isHoveringThumb || this.isHoveringThumb) {
                    app.canvas.setDirty(true);
                }
            };

            nodeType.prototype.onMouseDown = function (e, local_pos) {
                const widgetsHeight = this.getCanvasWidgetsHeight();
                const startY = widgetsHeight + 35;

                if (local_pos[1] >= startY + 140 && local_pos[1] <= startY + 200 && local_pos[0] >= 210) {
                    if (this.currentSeedValue && this.currentSeedValue !== "None" && this.currentSeedValue !== "ERROR") {
                        navigator.clipboard.writeText(this.currentSeedValue);
                        this.seedCopyFeedback = true;
                        app.canvas.setDirty(true);
                        setTimeout(() => { this.seedCopyFeedback = false; app.canvas.setDirty(true); }, 1200);
                        return true;
                    }
                }
            };

            nodeType.prototype.computeSize = function() {
                const widgetsHeight = this.getCanvasWidgetsHeight();
                const calculatedHeight = widgetsHeight + 250;
                return [350, calculatedHeight];
            };

            nodeType.prototype.onDrawBackground = function(ctx) {
                if (this.flags.collapsed) return;

                const widgetsHeight = this.getCanvasWidgetsHeight();
                const startY = widgetsHeight + 35;
                const padding = 14;
                const thumbSize = 110;
                const textStartX = padding + thumbSize + 20;
                const maxTextWidth = this.size[0] - textStartX - padding;
                const isJsonError = this.currentStyleName && this.currentStyleName.includes("⚠️ ERROR IN");

                const drawWrappedText = (text, x, y, maxLines = 4, targetWidth = maxTextWidth) => {
                    let lines = [];
                    let currentLine = "";
                    for (let i = 0; i < text.length; i++) {
                        let testLine = currentLine + text[i];
                        if (ctx.measureText(testLine).width > targetWidth) {
                            lines.push(currentLine);
                            currentLine = text[i];
                        } else { currentLine = testLine; }
                        if (lines.length === maxLines) break;
                    }
                    if (lines.length < maxLines) lines.push(currentLine);
                    lines.forEach((line, j) => {
                        ctx.fillText(line, x, y + (j * 8.2));
                    });
                    return y + (lines.length * 8.2);
                };

                ctx.save();

                ctx.fillStyle = "#1e1e24";
                ctx.beginPath();
                ctx.roundRect(padding - 3, startY - 3, thumbSize + 6, thumbSize + 6, 8);
                ctx.fill();

                ctx.lineWidth = 1.5;
                ctx.strokeStyle = isJsonError ? "#ff3333" : (this.previewImageLoaded ? "#3cd3ff" : "#d85a20");
                ctx.stroke();

                ctx.fillStyle = "#0d0d11";
                ctx.beginPath();
                ctx.roundRect(padding, startY, thumbSize, thumbSize, 5);
                ctx.fill();

                if (this.previewImageLoaded && this.previewImage) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.roundRect(padding, startY, thumbSize, thumbSize, 5);
                    ctx.clip();
                    ctx.drawImage(this.previewImage, padding, startY, thumbSize, thumbSize);
                    ctx.restore();
                } else {
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = isJsonError ? "rgba(255, 51, 51, 0.4)" : "rgba(216, 90, 32, 0.25)";
                    ctx.beginPath();
                    ctx.moveTo(padding, startY); ctx.lineTo(padding + thumbSize, startY + thumbSize);
                    ctx.moveTo(padding + thumbSize, startY); ctx.lineTo(padding, startY);
                    ctx.stroke();
                }

                ctx.fillStyle = isJsonError ? "#ff3333" : (this.previewImageLoaded ? "#3cd3ff" : "#ff7c43");
                ctx.font = "bold 11px sans-serif";
                ctx.fillText(String(this.currentStyleName).split(" / ").pop().toUpperCase(), textStartX, startY + 10);

                ctx.font = "7px sans-serif";
                let currentY = startY + 21;
                ctx.fillStyle = isJsonError ? "#ff7777" : "#a3e26c";
                ctx.fillText(isJsonError ? "File Alert Info:" : "Positive:", textStartX, currentY);
                currentY = drawWrappedText(this.currentPositiveText || "None", textStartX, currentY + 8.2, 4) + 2;

                ctx.fillStyle = isJsonError ? "#ff7777" : "#f37a7a";
                ctx.fillText(isJsonError ? "Action Required:" : "Negative:", textStartX, currentY);
                currentY = drawWrappedText(this.currentNegativeText || "None", textStartX, currentY + 8.2, 4);

                if (!isJsonError && this.detectedLoraNames && this.detectedLoraNames.length > 0) {
                    ctx.fillStyle = "#e2b16c";
                    ctx.fillText("Dependencies:", textStartX, currentY + 2);
                    currentY += 10.2;
                    for (let k = 0; k < Math.min(this.detectedLoraNames.length, 2); k++) {
                        const item = this.detectedLoraNames[k];
                        ctx.fillStyle = (item.type === "embed") ? "#a3e26c" : "#ffd8a8";
                        ctx.fillText(item.text, textStartX + 4, currentY);
                        currentY += 8.2;
                    }
                }

                const metadataTopY = startY + thumbSize + 32;
                ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
                ctx.beginPath();
                ctx.roundRect(padding, metadataTopY, this.size[0] - (padding * 2), 65, 4);
                ctx.fill();

                ctx.font = "7px monospace";
                if (isJsonError) {
                    ctx.fillStyle = "#ff3333";
                    ctx.fillText("CRITICAL JSON SYNTAX EXCEPTION:", padding + 8, metadataTopY + 12);
                } else {
                    ctx.fillStyle = this.previewImageLoaded ? "#9e9eb4" : "#ff5555";
                    ctx.fillText(this.previewImageLoaded ? "COMMENT / PARAMS:" : "DEBUG INFO (IMAGE NOT FOUND):", padding + 8, metadataTopY + 12);
                }

                ctx.fillStyle = "#ffffff";
                const hasValidSeed = (!isJsonError && this.currentSeedValue && this.currentSeedValue !== "None");
                drawWrappedText(this.currentCommentText || "None", padding + 8, metadataTopY + 22, 3, hasValidSeed ? 180 : 310);

                if (hasValidSeed) {
                    const seedX = padding + 202;
                    ctx.fillStyle = "#ffcc00";
                    ctx.font = "7px monospace";
                    ctx.fillText("SEED (CLICK TO COPY):", seedX, metadataTopY + 12);

                    if (this.seedCopyFeedback) {
                        ctx.fillStyle = "#a3e26c";
                        ctx.font = "bold 8px sans-serif";
                        ctx.fillText("✓ COPIED!", seedX, metadataTopY + 24);
                    } else {
                        ctx.fillStyle = "#3cd3ff";
                        ctx.font = "7px monospace";
                        ctx.fillText(this.currentSeedValue, seedX, metadataTopY + 24);
                    }
                }

                ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(padding + 6, metadataTopY + 51);
                ctx.lineTo(this.size[0] - padding - 6, metadataTopY + 51);
                ctx.stroke();

                ctx.fillStyle = isJsonError ? "#ff5555" : "#777788";
                ctx.font = "italic 7px sans-serif";
                ctx.fillText(`Source Configuration: character_packs/${this.currentSourceFile}`, padding + 8, metadataTopY + 60);

                if (this.isHoveringThumb && (this.activeThumbnailFile || this.expectedThumbnailFile)) {
                    ctx.font = "bold 9px sans-serif";

                    const line1 = `Rendering: ${this.activeThumbnailFile || "None"}`;
                    const isUsingFallback = (this.activeThumbnailFile !== this.expectedThumbnailFile);
                    const line2 = isUsingFallback ? `Expected: ${this.expectedThumbnailFile}` : null;

                    const width1 = ctx.measureText(line1).width;
                    const width2 = line2 ? ctx.measureText(line2).width : 0;
                    const tooltipWidth = Math.max(width1, width2) + 16;
                    const tooltipHeight = line2 ? 32 : 18;

                    let tooltipX = this.mousePos[0] + 10;
                    let tooltipY = this.mousePos[1] - (line2 ? 36 : 22);

                    if (tooltipX + tooltipWidth > this.size[0] - 10) {
                        tooltipX = this.size[0] - tooltipWidth - 10;
                    }

                    ctx.fillStyle = "rgba(15, 15, 20, 0.94)";
                    ctx.strokeStyle = isUsingFallback ? "#ff7c43" : "#3cd3ff";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(line1, tooltipX + 8, tooltipY + 12);

                    if (line2) {
                        ctx.fillStyle = "#ff7c43";
                        ctx.fillText(line2, tooltipX + 8, tooltipY + 25);
                    }
                }

                ctx.restore();
            };
        }
    }
});