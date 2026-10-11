float linearMask(float progress) {
	float weight = clamp(1.0 - progress, 0.0, 1.0);
	return weight * weight * (3.0 - 2.0 * weight);
}

#pragma glslify: export(linearMask)