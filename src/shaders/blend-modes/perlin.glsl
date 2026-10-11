#pragma glslify: linearMask = require('./linear.glsl')

vec3 mod289(vec3 value) { return value - floor(value * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 value) { return value - floor(value * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 value) { return mod289(((value * 34.0) + 1.0) * value); }

float snoise(vec2 value) {
	const vec4 constants = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
	vec2 cell = floor(value + dot(value, constants.yy));
	vec2 origin = value - cell + dot(cell, constants.xx);
	vec2 corner = (origin.x > origin.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
	vec4 positions = origin.xyxy + constants.xxzz;
	positions.xy -= corner;
	cell = mod289(cell);
	vec3 permutation = permute(permute(cell.y + vec3(0.0, corner.y, 1.0)) + cell.x + vec3(0.0, corner.x, 1.0));
	vec3 weights = max(0.5 - vec3(dot(origin, origin), dot(positions.xy, positions.xy), dot(positions.zw, positions.zw)), 0.0);
	weights = weights * weights;
	weights = weights * weights;
	vec3 gradients = 2.0 * fract(permutation * constants.www) - 1.0;
	vec3 heights = abs(gradients) - 0.5;
	vec3 rounded = floor(gradients + 0.5);
	vec3 normalized = gradients - rounded;
	weights *= 1.79284291400159 - 0.85373472095314 * (normalized * normalized + heights * heights);
	vec3 contributions;
	contributions.x = normalized.x * origin.x + heights.x * origin.y;
	contributions.yz = normalized.yz * positions.xz + heights.yz * positions.yw;
	return 130.0 * dot(weights, contributions);
}

float fbm(vec2 coordinate, int octaves, float scale) {
	float value = 0.0;
	float amplitude = 0.5;
	vec2 shift = vec2(100.0);
	mat2 rotation = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
	vec2 position = coordinate * scale;
	for (int octave = 0; octave < 8; octave++) {
		if (octave >= octaves) break;
		value += amplitude * snoise(position);
		position = rotation * position * 2.0 + shift;
		amplitude *= 0.5;
	}
	return value;
}

float perlinMask(float distance, float blendWidth, float edgeCoord, float scale, float octaves) {
	float offset = 0.45 * fbm(vec2(distance, edgeCoord), int(octaves), scale / 1000.0);
	return linearMask(distance / blendWidth - offset);
}

#pragma glslify: export(perlinMask)