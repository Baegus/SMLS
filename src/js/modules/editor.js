import Cropper from "cropperjs";
import { saveAs } from "file-saver";
import { createElement, Link, Unlink } from "lucide";
import { debounce } from "./utils.js";
import { findPattern } from "./algorithms.js";
import { createRenderer } from "./renderer.js";
import { createPreview } from "./preview.js";

export function initEditor() {
	// DOM Elements
	const dropZone = document.getElementById("drop-zone");
	const imageInput = document.getElementById("image-input");
	const imageToCrop = document.getElementById("image-to-crop");
	const downloadBtn = document.getElementById("download-btn");
	const resetBtn = document.getElementById("reset-btn");

	// Canvas Elements
	const previewCanvas = document.getElementById("preview-canvas");
	const webglCanvas = document.getElementById("webgl-canvas");
	const showTransitionsCheckbox = document.getElementById("show-transitions");
	const loopXCheckbox = document.getElementById("loop-x");
	const loopYCheckbox = document.getElementById("loop-y");
	const algoContainer = document.getElementById("algo-container");
	const blendModeSelect = document.getElementById("blend-mode");
	const blendSliderContainer = document.getElementById(
		"blend-slider-container"
	);
	const blendSliderX = document.getElementById("blend-amount-x");
	const blendSliderY = document.getElementById("blend-amount-y");
	const blendValueSpanX = document.getElementById("blend-value-x");
	const blendValueSpanY = document.getElementById("blend-value-y");
	const blendLinkButton = document.getElementById("blend-link");
	const wavinessContainer = document.getElementById("waviness-container");
	const wavinessSlider = document.getElementById("waviness");
	const wavinessValueSpan = document.getElementById("waviness-value");
	const perlinScaleContainer = document.getElementById(
		"perlin-scale-container"
	);
	const perlinScaleSlider = document.getElementById("perlin-scale");
	const perlinScaleValueSpan = document.getElementById("perlin-scale-value");
	const perlinOctavesContainer = document.getElementById(
		"perlin-octaves-container"
	);
	const perlinOctavesSlider = document.getElementById("perlin-octaves");
	const perlinOctavesValueSpan = document.getElementById(
		"perlin-octaves-value"
	);
	const cropSizeContainer = document.getElementById("crop-size-container");
	const cropWidthInput = document.getElementById("crop-width-input");
	const cropHeightInput = document.getElementById("crop-height-input");

	// ---- State
	let cropper, sourceImage, cropData;
	let textureImage = null;
	let uploadedFileName = "image";
	let currentObjectUrl = null;
	let blendLinked = true;

	const renderer = createRenderer(webglCanvas);
	const preview = createPreview(previewCanvas, renderView);

	// --- Event Listeners ---
	dropZone.addEventListener("click", () => imageInput.click());
	dropZone.addEventListener("dragover", (e) => {
		e.preventDefault();
		dropZone.style.borderColor = "#0052cc";
	});
	dropZone.addEventListener("dragleave", () => {
		dropZone.style.borderColor = "#dfe1e6";
	});
	dropZone.addEventListener("drop", (e) => {
		e.preventDefault();
		e.stopPropagation();
		dropZone.style.borderColor = "#dfe1e6";
		if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
	});
	imageInput.addEventListener("change", (e) => {
		if (e.target.files.length) handleFile(e.target.files[0]);
	});
	window.addEventListener("dragover", (e) => e.preventDefault());
	window.addEventListener("drop", (e) => {
		e.preventDefault();
		if (e.dataTransfer.files && e.dataTransfer.files.length > 0)
			handleFile(e.dataTransfer.files[0]);
	});

	const handleSizeInputChange = () => {
		if (!cropper || !sourceImage) return;
		const newWidth = parseInt(cropWidthInput.value, 10);
		const newHeight = parseInt(cropHeightInput.value, 10);
		if (isNaN(newWidth) || isNaN(newHeight) || newWidth <= 0 || newHeight <= 0)
			return;
		const clampedWidth = Math.min(newWidth, sourceImage.naturalWidth);
		const clampedHeight = Math.min(newHeight, sourceImage.naturalHeight);
		cropWidthInput.value = clampedWidth;
		cropHeightInput.value = clampedHeight;
		cropper.setData({ width: clampedWidth, height: clampedHeight });
	};
	const debouncedSizeChange = debounce(handleSizeInputChange, 300);
	cropWidthInput.addEventListener("input", debouncedSizeChange);
	cropHeightInput.addEventListener("input", debouncedSizeChange);

	const updateTexture = () => preview.draw();

	function updateBlendValues() {
		blendValueSpanX.textContent = blendSliderX.value;
		blendValueSpanY.textContent = blendSliderY.value;
		updateTexture();
	}

	function updateBlendLink() {
		blendLinkButton.setAttribute("aria-pressed", String(blendLinked));
		blendLinkButton.title = blendLinked
			? "Unlink X and Y blend amounts"
			: "Link X and Y blend amounts (use X value)";
		blendLinkButton.replaceChildren(createElement(blendLinked ? Link : Unlink, {
			width: 20,
			height: 20,
			"aria-hidden": "true"
		}));
	}

	blendSliderX.addEventListener("input", () => {
		if (blendLinked) blendSliderY.value = blendSliderX.value;
		updateBlendValues();
	});
	blendSliderY.addEventListener("input", () => {
		if (blendLinked) blendSliderX.value = blendSliderY.value;
		updateBlendValues();
	});
	blendLinkButton.addEventListener("click", () => {
		blendLinked = !blendLinked;
		if (blendLinked) blendSliderY.value = blendSliderX.value;
		updateBlendLink();
		updateBlendValues();
	});
	updateBlendLink();
	wavinessSlider.addEventListener("input", () => {
		wavinessValueSpan.textContent = wavinessSlider.value;
		updateTexture();
	});
	perlinScaleSlider.addEventListener("input", () => {
		perlinScaleValueSpan.textContent = perlinScaleSlider.value;
		updateTexture();
	});
	perlinOctavesSlider.addEventListener("input", () => {
		perlinOctavesValueSpan.textContent = perlinOctavesSlider.value;
		updateTexture();
	});

	blendModeSelect.addEventListener("change", () => {
		const mode = blendModeSelect.value;
		wavinessContainer.style.display = mode === "wavy" ? "block" : "none";
		perlinScaleContainer.style.display = mode === "perlin" ? "block" : "none";
		perlinOctavesContainer.style.display = mode === "perlin" ? "block" : "none";
		updateTexture();
	});

	downloadBtn.addEventListener("click", () => {
		if (!textureImage || !cropData) return;
		renderer.render(textureImage, cropData, getSettings());
		webglCanvas.toBlob(function (blob) {
			const fileName = `SMLS_${cropData.width}x${cropData.height}_${uploadedFileName}.png`;
			saveAs(blob, fileName);
			// Shrinks the WebGL canvas back to preview size
			preview.draw();
		}, "image/png");
	});

	resetBtn.addEventListener("click", () => {
		if (confirm("Are you sure you want to discard the current image?"))
			resetTool();
	});

	showTransitionsCheckbox.addEventListener("change", updateTexture);
	const updateLooping = () => {
		preview.setLooping(loopXCheckbox.checked, loopYCheckbox.checked);
	};
	loopXCheckbox.addEventListener("change", updateLooping);
	loopYCheckbox.addEventListener("change", updateLooping);

	function handleFile(file) {
		if (!file.type.startsWith("image/")) return;
		if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
		uploadedFileName = file.name.replace(/\.[^/.]+$/, "");
		currentObjectUrl = URL.createObjectURL(file);
		imageToCrop.classList.remove("loaded");
		textureImage = null;
		cropData = null;
		const image = new Image();
		sourceImage = image;
		sourceImage.onload = () => {
			imageToCrop.src = currentObjectUrl;
			dropZone.style.display = "none";
			cropSizeContainer.style.display = "flex";
			algoContainer.style.display = "block";
			blendSliderContainer.style.display = "block";
			const mode = blendModeSelect.value;
			wavinessContainer.style.display = mode === "wavy" ? "block" : "none";
			perlinScaleContainer.style.display = mode === "perlin" ? "block" : "none";
			perlinOctavesContainer.style.display =
				mode === "perlin" ? "block" : "none";
			downloadBtn.disabled = false;
			resetBtn.style.display = "block";

			loadTexture(file, image);

			if (cropper) cropper.destroy();
			cropper = new Cropper(imageToCrop, {
				viewMode: 1,
				background: false,
				zoomable: false,
				crop: () => {
					const data = cropper.getData({ rounded: true });
					cropData = data;
					if (
						document.activeElement !== cropWidthInput &&
						document.activeElement !== cropHeightInput
					) {
						cropWidthInput.value = data.width;
						cropHeightInput.value = data.height;
					}
					preview.draw();
				},
				ready: function () {
					this.cropper.setData({
						x: 0,
						y: 0,
						width: sourceImage.naturalWidth * 0.9,
						height: sourceImage.naturalHeight * 0.9
					});
				}
			});
			imageToCrop.classList.add("loaded");
		};
		sourceImage.src = currentObjectUrl;
	}

	function resetTool() {
		if (cropper) {
			cropper.destroy();
			cropper = null;
		}
		imageToCrop.src = "";
		imageToCrop.classList.remove("loaded");
		dropZone.style.display = "block";
		cropSizeContainer.style.display = "none";
		algoContainer.style.display = "none";
		blendSliderContainer.style.display = "none";
		wavinessContainer.style.display = "none";
		perlinScaleContainer.style.display = "none";
		perlinOctavesContainer.style.display = "none";
		downloadBtn.disabled = true;
		resetBtn.style.display = "none";
		preview.reset();
		if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
		sourceImage = null;
		textureImage = null;
		cropData = null;
		currentObjectUrl = null;
		uploadedFileName = "image";

		imageInput.value = null;
	}

	// --- AUTO-FIND LOGIC (CPU) ---
	const findBtn = document.getElementById("find-pattern-btn");
	findBtn.addEventListener("click", findBestCrop);

	async function findBestCrop() {
		if (!sourceImage || !cropper) return;

		if (sourceImage.naturalWidth * sourceImage.naturalHeight > 4e6) {
			if (
				!confirm(
					"The image is quite large and automatic pattern detection may take a while. Do you want to proceed?"
				)
			) {
				return;
			}
		}

		const originalText = findBtn.innerHTML;
		findBtn.disabled = true;
		findBtn.innerHTML = "Analyzing...";
		await new Promise((resolve) => setTimeout(resolve, 10));

		try {
			const crop = findPattern(sourceImage);
			if (crop) cropper.setData(crop);
			else alert("Could not automatically detect a repeating pattern.");
		} finally {
			findBtn.disabled = false;
			findBtn.innerHTML = originalText;
		}
	}

	// Decodes off the main thread when possible, so large images don't block the UI on upload
	async function loadTexture(file, image) {
		let bitmap = null;
		try {
			bitmap = await createImageBitmap(file, {
				imageOrientation: "from-image",
				premultiplyAlpha: "none"
			});
		} catch {
			// Fall back to uploading the <img> directly
		}
		if (sourceImage !== image) {
			bitmap?.close();
			return;
		}
		if (
			bitmap &&
			(bitmap.width !== image.naturalWidth || bitmap.height !== image.naturalHeight)
		) {
			bitmap.close();
			bitmap = null;
		}
		renderer.uploadTexture(bitmap ?? image);
		bitmap?.close();
		textureImage = image;
		preview.draw();
	}

	function getSettings() {
		return {
			blendAmountX: blendSliderX.value,
			blendAmountY: blendSliderY.value,
			blendMode: blendModeSelect.value,
			waviness: wavinessSlider.value,
			perlinScale: perlinScaleSlider.value,
			perlinOctaves: perlinOctavesSlider.value,
			showTransitions: showTransitionsCheckbox.checked
		};
	}

	function renderView(view) {
		if (!textureImage || !cropData) return null;
		renderer.render(textureImage, cropData, getSettings(), view);
		return webglCanvas;
	}
}
