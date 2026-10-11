export function createPreview(previewCanvas, webglCanvas) {
	const previewCtx = previewCanvas.getContext("2d");
	let transform = { x: 0, y: 0, zoom: 1 };
	let loopX = true;
	let loopY = true;
	let isPanning = false;
	let lastMousePos = { x: 0, y: 0 };
	let initialPinchDistance = null;
	// Preview Interactions
	previewCanvas.addEventListener("wheel", handleZoom, { passive: false });
	previewCanvas.addEventListener("mousedown", (e) => {
		isPanning = true;
		lastMousePos = { x: e.clientX, y: e.clientY };
		document.body.style.cursor = "grabbing";
	});
	document.addEventListener("mousemove", (e) => {
		if (!isPanning) return;
		transform.x += e.clientX - lastMousePos.x;
		transform.y += e.clientY - lastMousePos.y;
		lastMousePos = { x: e.clientX, y: e.clientY };
		drawPreview();
	});
	document.addEventListener("mouseup", () => {
		isPanning = false;
		document.body.style.cursor = "";
	});
	previewCanvas.addEventListener("mouseenter", (e) => {
		if ((e.buttons & 1) === 0) {
			isPanning = false;
			document.body.style.cursor = "";
		}
	});
	previewCanvas.addEventListener("dblclick", () => {
		transform = { x: 0, y: 0, zoom: 1 };
		drawPreview();
	});
	// Touch
	previewCanvas.addEventListener(
		"touchstart",
		(e) => {
			e.preventDefault();
			if (e.touches.length === 1) {
				isPanning = true;
				lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
			} else if (e.touches.length === 2) {
				isPanning = false;
				const dx = e.touches[0].clientX - e.touches[1].clientX;
				const dy = e.touches[0].clientY - e.touches[1].clientY;
				initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
			}
		},
		{ passive: false }
	);
	previewCanvas.addEventListener(
		"touchmove",
		(e) => {
			e.preventDefault();
			if (e.touches.length === 1 && isPanning) {
				const touch = e.touches[0];
				transform.x += touch.clientX - lastMousePos.x;
				transform.y += touch.clientY - lastMousePos.y;
				lastMousePos = { x: touch.clientX, y: touch.clientY };
				drawPreview();
			} else if (e.touches.length === 2 && initialPinchDistance) {
				const dx = e.touches[0].clientX - e.touches[1].clientX;
				const dy = e.touches[0].clientY - e.touches[1].clientY;
				const dist = Math.sqrt(dx * dx + dy * dy);
				const scale = dist / initialPinchDistance;
				const rect = previewCanvas.getBoundingClientRect();
				const mX =
					(e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
				const mY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
				const oZ = transform.zoom;
				transform.zoom = Math.max(0.1, Math.min(10, transform.zoom * scale));
				transform.x = mX - (mX - transform.x) * (transform.zoom / oZ);
				transform.y = mY - (mY - transform.y) * (transform.zoom / oZ);
				initialPinchDistance = dist;
				drawPreview();
			}
		},
		{ passive: false }
	);
	previewCanvas.addEventListener("touchend", (e) => {
		if (e.touches.length < 2) initialPinchDistance = null;
		if (e.touches.length < 1) isPanning = false;
		if (e.touches.length === 1) {
			isPanning = true;
			lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
		}
	});

	window.addEventListener("resize", drawPreview);
	function handleZoom(e) {
		e.preventDefault();
		const scale = 1.1;
		const rect = previewCanvas.getBoundingClientRect();
		const mX = e.clientX - rect.left;
		const mY = e.clientY - rect.top;
		const oZ = transform.zoom;
		transform.zoom *= e.deltaY < 0 ? scale : 1 / scale;
		transform.zoom = Math.max(0.1, Math.min(10, transform.zoom));
		transform.x = mX - (mX - transform.x) * (transform.zoom / oZ);
		transform.y = mY - (mY - transform.y) * (transform.zoom / oZ);
		drawPreview();
	}

	function drawPreview() {
		const rect = previewCanvas.getBoundingClientRect();
		if (
			rect.width !== previewCanvas.width ||
			rect.height !== previewCanvas.height
		) {
			previewCanvas.width = rect.width;
			previewCanvas.height = rect.height;
		}

		previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
		if (webglCanvas.width === 0) return;

		const repetition = loopX
			? (loopY ? "repeat" : "repeat-x")
			: (loopY ? "repeat-y" : "no-repeat");
		const pattern = previewCtx.createPattern(webglCanvas, repetition);
		previewCtx.save();
		previewCtx.translate(transform.x, transform.y);
		previewCtx.scale(transform.zoom, transform.zoom);
		previewCtx.fillStyle = pattern;

		const pW = previewCanvas.width;
		const pH = previewCanvas.height;
		const startX = -transform.x / transform.zoom;
		const startY = -transform.y / transform.zoom;
		const w = pW / transform.zoom;
		const h = pH / transform.zoom;

		previewCtx.fillRect(startX, startY, w, h);
		previewCtx.restore();
	}

	return {
		draw: drawPreview,
		setLooping(x, y) {
			loopX = x;
			loopY = y;
			drawPreview();
		},
		reset() {
			transform = { x: 0, y: 0, zoom: 1 };
			isPanning = false;
			initialPinchDistance = null;
			previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
		}
	};
}
