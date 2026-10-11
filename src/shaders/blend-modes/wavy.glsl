#pragma glslify: linearMask = require('./linear.glsl')

float wavyMask(float distance, float blendWidth, float edgeCoord, float orthoSize, float waviness) {
	float amplitude = min(0.45, (waviness / 100.0) * 0.5);
	float waves = max(1.0, floor((waviness / 100.0) * 8.0));
	float coordinate = edgeCoord / max(1.0, orthoSize);
	float wave = 0.7 * sin(6.28 * waves * coordinate) + 0.3 * sin(6.28 * waves * 2.0 * coordinate);
	return linearMask(distance / blendWidth - amplitude * wave);
}

#pragma glslify: export(wavyMask)