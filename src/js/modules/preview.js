// renderView(view) renders the visible area and returns the source canvas, or null if nothing to show
export function createPreview(previewCanvas, renderView) {
	const previewCtx = previewCanvas.getContext("2d");
	let drawPending = false;
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
		if (drawPending) return;
		drawPending = true;
		requestAnimationFrame(drawNow);
	}

	function drawNow() {
		drawPending = false;
		const rect = previewCanvas.getBoundingClientRect();
		const width = Math.round(rect.width);
		const height = Math.round(rect.height);
		if (width !== previewCanvas.width || height !== previewCanvas.height) {
			previewCanvas.width = width;
			previewCanvas.height = height;
		}

		previewCtx.clearRect(0, 0, width, height);
		if (width === 0 || height === 0) return;

		const source = renderView({
			width,
			height,
			x: transform.x,
			y: transform.y,
			zoom: transform.zoom,
			loopX,
			loopY
		});
		if (source) previewCtx.drawImage(source, 0, 0);
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
