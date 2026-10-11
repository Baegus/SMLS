export function findPattern(sourceImage) {
	const MAX_DIM = 256;
	const MIN_CROP_FACTOR = 0.5;
	const coarseCanvas = document.createElement("canvas");
	const coarseCtx = coarseCanvas.getContext("2d", { willReadFrequently: true });
	const scale = Math.min(
		1,
		MAX_DIM / sourceImage.naturalWidth,
		MAX_DIM / sourceImage.naturalHeight
	);
	const coarseW = Math.round(sourceImage.naturalWidth * scale);
	const coarseH = Math.round(sourceImage.naturalHeight * scale);
	coarseCanvas.width = coarseW;
	coarseCanvas.height = coarseH;
	coarseCtx.drawImage(sourceImage, 0, 0, coarseW, coarseH);
	const coarseFeat = getFeatureData(coarseCtx, coarseW, coarseH);

	const fullCanvas = document.createElement("canvas");
	const fullCtx = fullCanvas.getContext("2d", { willReadFrequently: true });
	fullCanvas.width = sourceImage.naturalWidth;
	fullCanvas.height = sourceImage.naturalHeight;
	fullCtx.drawImage(sourceImage, 0, 0);
	const fullFeat = getFeatureData(fullCtx, fullCanvas.width, fullCanvas.height);

	const { periodX, periodY } = findPeriodicity(
		coarseFeat,
		coarseW,
		coarseH,
		coarseW * MIN_CROP_FACTOR,
		coarseH * MIN_CROP_FACTOR,
		fullFeat,
		fullCanvas.width,
		fullCanvas.height,
		scale
	);

	if (periodX <= 10 || periodY <= 10) return null;
	const { bestX, bestY } = findBestOrigin(
		fullFeat,
		fullCanvas.width,
		fullCanvas.height,
		periodX,
		periodY
	);
	return {
		x: Math.max(0, Math.min(bestX, fullCanvas.width - periodX - 1)),
		y: Math.max(0, Math.min(bestY, fullCanvas.height - periodY - 1)),
		width: periodX,
		height: periodY
	};
}

function getFeatureData(ctx, width, height) {
	const { data } = ctx.getImageData(0, 0, width, height);
	const gray = new Float32Array(width * height);
	for (let i = 0, p = 0; i < data.length; i += 4, p++) {
		gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
	}
	return gray;
}

function findPeriodicity(coarseFeat, cW, cH, tX, tY, fullFeat, fW, fH, scale) {
	const estX = findBestShift(coarseFeat, cW, cH, "h", tX, 10);
	const estY = findBestShift(coarseFeat, cW, cH, "v", tY, 10);
	const sX = Math.round(estX / scale);
	const sY = Math.round(estY / scale);
	const rad = 30;
	const pX = findBestShift(
		fullFeat,
		fW,
		fH,
		"h",
		Math.max(10, sX - rad),
		10,
		sX + rad
	);
	const pY = findBestShift(
		fullFeat,
		fW,
		fH,
		"v",
		Math.max(10, sY - rad),
		10,
		sY + rad
	);
	return { periodX: pX, periodY: pY };
}

function findBestShift(gray, w, h, dir, target, minS, maxS = null) {
	const limit = maxS || Math.floor((dir === "h" ? w : h) * 0.95);
	const scores = [];
	for (let s = minS; s < limit; s++) {
		let diff = 0;
		if (dir === "h") {
			for (let y = 0; y < h; y += 4)
				for (let x = 0; x < w - s; x += 8)
					diff += Math.abs(gray[y * w + x] - gray[y * w + x + s]);
		} else {
			for (let x = 0; x < w; x += 4)
				for (let y = 0; y < h - s; y += 8)
					diff += Math.abs(gray[y * w + x] - gray[(y + s) * w + x]);
		}
		scores.push({ s, v: diff });
	}
	if (!scores.length) return 0;
	if (maxS !== null) return scores.reduce((m, p) => (p.v < m.v ? p : m)).s;

	const mins = [];
	for (let i = 1; i < scores.length - 1; i++) {
		if (scores[i].v < scores[i - 1].v && scores[i].v < scores[i + 1].v)
			mins.push(scores[i].s);
	}
	const c = mins.filter((v) => v >= target);
	return c.length ? c[0] : mins.length ? mins[mins.length - 1] : scores[0].s;
}

function findBestOrigin(feat, w, h, pX, pY) {
	const stride = Math.max(1, Math.floor(pX / 4));
	let best = Infinity,
		bx = 0,
		by = 0;
	for (let y = 0; y < h - pY; y += stride) {
		for (let x = 0; x < w - pX; x += stride) {
			let score = 0;
			const i1 = y * w + (x + pX - 1);
			const i2 = y * w + (x + pX);
			score += Math.abs(feat[i1] - feat[i2]);
			const i3 = (y + pY - 1) * w + x;
			const i4 = (y + pY) * w + x;
			score += Math.abs(feat[i3] - feat[i4]);
			if (score < best) {
				best = score;
				bx = x;
				by = y;
			}
		}
	}
	return { bestX: bx, bestY: by };
}
