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
	const uniforms = {};
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
		gl.useProgram(glProgram);

		// Buffers (Full Quad)
		const positions = new Float32Array([
			-1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0
		]);
		buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

		const posLoc = gl.getAttribLocation(glProgram, "a_position");
		const texLoc = gl.getAttribLocation(glProgram, "a_texCoord");
		gl.enableVertexAttribArray(posLoc);
		gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
		gl.enableVertexAttribArray(texLoc);
		gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);

		for (const name of [
			"u_imgRes", "u_crop", "u_blendSize", "u_mode", "u_params", "u_offsets",
			"u_showTrans", "u_preview", "u_view", "u_viewSize", "u_loop", "u_samples"
		]) {
			uniforms[name] = gl.getUniformLocation(glProgram, name);
		}
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
	// Without `view`, renders the full-resolution tile (for export).
	// With `view`, renders only the visible preview area at preview resolution.
	function render(image, crop, settings, view = null) {
		if (!image || !gl) return;

		const finalW = view ? view.width : crop.width;
		const finalH = view ? view.height : crop.height;

		// Avoid exploding the browser with too large textures
		if (!view && (finalW > 8192 || finalH > 8192)) {
			warn("Texture exceeds 8192 pixels; rendering may exceed device limits.");
			// Logic to warn user could go here
		}

		// Assigning canvas size reallocates the drawing buffer, even when unchanged
		if (webglCanvas.width !== finalW) webglCanvas.width = finalW;
		if (webglCanvas.height !== finalH) webglCanvas.height = finalH;
		gl.viewport(0, 0, finalW, finalH);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		const sx = crop.x;
		const sy = crop.y;
		const sw = crop.width;
		const sh = crop.height;
		const imgW = image.naturalWidth ?? image.width;
		const imgH = image.naturalHeight ?? image.height;

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

		gl.uniform2f(uniforms.u_imgRes, imgW, imgH);
		gl.uniform4f(uniforms.u_crop, sx, sy, sw, sh);
		gl.uniform2f(
			uniforms.u_blendSize,
			Math.floor(Math.min(Math.max(leftExcess, rightExcess), sw / 2) * settings.blendAmountX / 100),
			Math.floor(Math.min(Math.max(topExcess, bottomExcess), sh / 2) * settings.blendAmountY / 100)
		);

		let modeIdx = 0;
		if (settings.blendMode === "wavy") modeIdx = 1;
		if (settings.blendMode === "perlin") modeIdx = 2;
		gl.uniform1i(uniforms.u_mode, modeIdx);

		gl.uniform3f(
			uniforms.u_params,
			parseFloat(settings.waviness),
			parseFloat(settings.perlinScale),
			parseFloat(settings.perlinOctaves)
		);

		gl.uniform2f(uniforms.u_offsets, offX, offY);
		gl.uniform1i(uniforms.u_showTrans, settings.showTransitions ? 1 : 0);

		gl.uniform1i(uniforms.u_preview, view ? 1 : 0);
		if (view) {
			gl.uniform3f(uniforms.u_view, view.x, view.y, view.zoom);
			gl.uniform2f(uniforms.u_viewSize, finalW, finalH);
			gl.uniform2f(uniforms.u_loop, view.loopX ? 1 : 0, view.loopY ? 1 : 0);
			gl.uniform1i(uniforms.u_samples, Math.min(4, Math.max(1, Math.ceil(1 / view.zoom - 0.001))));
		}

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	return { uploadTexture, render };
}
