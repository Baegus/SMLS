precision highp float;
varying vec2 v_texCoord;

uniform sampler2D u_image;
uniform vec2 u_imgRes;
uniform vec4 u_crop;       // x, y, width, height
uniform float u_blendAmt;
uniform int u_mode;        // 0=linear, 1=wavy, 2=perlin
uniform vec3 u_params;     // x=waviness/amp, y=scale, z=octaves
uniform vec2 u_offsets;    // x=horizontal offset, y=vertical offset
uniform bool u_showTrans;

#pragma glslify: linearMask = require('./blend-modes/linear.glsl')
#pragma glslify: wavyMask = require('./blend-modes/wavy.glsl')
#pragma glslify: perlinMask = require('./blend-modes/perlin.glsl')

float getMask(float dist, float blendW, float edgeCoord, float orthoSize) {
	if (blendW <= 0.001) return 0.0;
	if (u_mode == 1) {
		return wavyMask(dist, blendW, edgeCoord, orthoSize, u_params.x);
	} else if (u_mode == 2) {
		return perlinMask(dist, blendW, edgeCoord, u_params.y, u_params.z);
	}
	return linearMask(dist / blendW);
}

// Core Logic: Generates ONE single seamless tile from UV (0..1)
vec4 getSingleSeamlessTile(vec2 uv) {
	// Convert 0..1 UV back to pixel coordinates relative to the crop
	vec2 pixelPos = uv * u_crop.zw;
	vec2 srcOrigin = u_crop.xy;
	
	vec4 finalColor = texture2D(u_image, (srcOrigin + pixelPos) / u_imgRes);
	
	float blendX = floor(u_blendAmt * u_crop.z);
	float blendY = floor(u_blendAmt * u_crop.w);
	
	float alphaH = 0.0;
	float alphaV = 0.0;
	
	// --- Horizontal Blend ---
	if (abs(u_offsets.x) > 0.0) {
		bool isLeftEdge = (u_offsets.x > 0.0);
		float dist = isLeftEdge ? pixelPos.x : (u_crop.z - pixelPos.x);
		
		if (dist < blendX) {
			alphaH = getMask(dist, blendX, pixelPos.y, u_crop.w);
			vec2 samplePos = srcOrigin + pixelPos;
			samplePos.x += u_offsets.x;
			vec4 blendCol = texture2D(u_image, samplePos / u_imgRes);
			finalColor = mix(finalColor, blendCol, alphaH);
		}
	}

	// --- Vertical Blend ---
	if (abs(u_offsets.y) > 0.0) {
		bool isTopEdge = (u_offsets.y > 0.0);
		float dist = isTopEdge ? pixelPos.y : (u_crop.w - pixelPos.y);
		
		if (dist < blendY) {
			alphaV = getMask(dist, blendY, pixelPos.x, u_crop.z);
			
			vec2 samplePosBase = srcOrigin + pixelPos;
			samplePosBase.y += u_offsets.y;
			
			vec4 blendCol = texture2D(u_image, samplePosBase / u_imgRes);
			
			// Corner logic for vertical blend source
			if (abs(u_offsets.x) > 0.0) {
				bool isLeftEdge = (u_offsets.x > 0.0);
				float distX = isLeftEdge ? pixelPos.x : (u_crop.z - pixelPos.x);
				if (distX < blendX) {
					float aH2 = getMask(distX, blendX, pixelPos.y + u_offsets.y, u_crop.w);
					vec2 samplePosCross = samplePosBase;
					samplePosCross.x += u_offsets.x;
					vec4 crossCol = texture2D(u_image, samplePosCross / u_imgRes);
					blendCol = mix(blendCol, crossCol, aH2);
				}
			}
			
			finalColor = mix(finalColor, blendCol, alphaV);
		}
	}

	if (u_showTrans) {
		float maxA = max(alphaH, alphaV);
		if (maxA <= 0.0) return vec4(0.0); // Transparent if showing transitions
		return vec4(finalColor.rgb, maxA); 
	}

	return finalColor;
}

void main() {
	gl_FragColor = getSingleSeamlessTile(v_texCoord);
}
