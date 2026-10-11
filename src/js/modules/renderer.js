import vertexSource from "../../shaders/vertex.glsl";
import fragmentSource from "../../shaders/fragment.glsl";
import { warn } from "./debug.js";

export function createRenderer(webglCanvas) {
	// Create WebGL context. preserveDrawingBuffer is needed for toBlob/saving,
	// but requires manual clearing (added in render function).
	// Disable premultipliedAlpha to ensure semi-transparent pixels render correctly
	const gl = webglCanvas.getContext("webgl", {
		preserveDrawingBuffer: true,
		alpha: true,
		premultipliedAlpha: false
	});

	let glProgram, glTexture;
	let buffer;
	// --- Setup WebGL ---
	function initWebGL() {
		if (!gl) {
			alert("WebGL not supported");
			return;
		}

		const vsSource = vertexSource;
		const fsSource = fragmentSource;

		const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
		const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
		glProgram = createProgram(gl, vs, fs);

		// Buffers (Full Quad)
		const positions = new Float32Array([
			-1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0
		]);
		buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
	}

	function createShader(gl, type, source) {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			const message = gl.getShaderInfoLog(shader);
			gl.deleteShader(shader);
			throw new Error(message);
		}
		return shader;
	}

	function createProgram(gl, vs, fs) {
		const program = gl.createProgram();
		gl.attachShader(program, vs);
		gl.attachShader(program, fs);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(gl.getProgramInfoLog(program));
		}
		return program;
	}

	function uploadTexture(image) {
		if (glTexture) gl.deleteTexture(glTexture);
		glTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, glTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	}

	initWebGL();

	// --- MAIN RENDER FUNCTION ---
	function render(image, crop, settings) {
		if (!image || !gl) return;

		const finalW = crop.width;
		const finalH = crop.height;

		// Avoid exploding the browser with too large textures
		if (finalW > 8192 || finalH > 8192) {
			warn("Texture exceeds 8192 pixels; rendering may exceed device limits.");
			// Logic to warn user could go here
		}

		webglCanvas.width = finalW;
		webglCanvas.height = finalH;
		gl.viewport(0, 0, finalW, finalH);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(glProgram);

		const posLoc = gl.getAttribLocation(glProgram, "a_position");
		const texLoc = gl.getAttribLocation(glProgram, "a_texCoord");

		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(posLoc);
		gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
		gl.enableVertexAttribArray(texLoc);
		gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);

		const sx = crop.x;
		const sy = crop.y;
		const sw = crop.width;
		const sh = crop.height;
		const imgW = image.naturalWidth;
		const imgH = image.naturalHeight;

		const rightExcess = imgW - (sx + sw);
		const leftExcess = sx;
		const bottomExcess = imgH - (sy + sh);
		const topExcess = sy;

		let offX = 0;
		let offY = 0;

		if (rightExcess >= leftExcess && rightExcess > 0) {
			offX = sw;
		} else if (leftExcess > 0) {
			offX = -sw;
		}

		if (bottomExcess >= topExcess && bottomExcess > 0) {
			offY = sh;
		} else if (topExcess > 0) {
			offY = -sh;
		}

		const uImgRes = gl.getUniformLocation(glProgram, "u_imgRes");
		const uCrop = gl.getUniformLocation(glProgram, "u_crop");
		const uBlendAmt = gl.getUniformLocation(glProgram, "u_blendAmt");
		const uMode = gl.getUniformLocation(glProgram, "u_mode");
		const uParams = gl.getUniformLocation(glProgram, "u_params");
		const uOffsets = gl.getUniformLocation(glProgram, "u_offsets");
		const uShowTrans = gl.getUniformLocation(glProgram, "u_showTrans");

		gl.uniform2f(uImgRes, imgW, imgH);
		gl.uniform4f(uCrop, sx, sy, sw, sh);
		gl.uniform1f(uBlendAmt, settings.blendAmount / 100);

		let modeIdx = 0;
		if (settings.blendMode === "wavy") modeIdx = 1;
		if (settings.blendMode === "perlin") modeIdx = 2;
		gl.uniform1i(uMode, modeIdx);

		gl.uniform3f(
			uParams,
			parseFloat(settings.waviness),
			parseFloat(settings.perlinScale),
			parseFloat(settings.perlinOctaves)
		);

		gl.uniform2f(uOffsets, offX, offY);
		gl.uniform1i(uShowTrans, settings.showTransitions ? 1 : 0);

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	return { uploadTexture, render };
}
