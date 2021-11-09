/**
 * @license
 * Copyright 2016 Google Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export const glsl_COLORMAPS = (`vec3 colormapJet(float x) {
  vec3 result;
  result.r = x < 0.89 ? ((x - 0.35) / 0.31) : (1.0 - (x - 0.89) / 0.11 * 0.5);
  result.g = x < 0.64 ? ((x - 0.125) * 4.0) : (1.0 - (x - 0.64) / 0.27);
  result.b = x < 0.34 ? (0.5 + x * 0.5 / 0.11) : (1.0 - (x - 0.34) / 0.31);
  return clamp(result, 0.0, 1.0);
}
` +
/*
 * Adapted from http://www.mrao.cam.ac.uk/~dag/CUBEHELIX/CubeHelix.m
 * which is licensed under http://unlicense.org/
 */
`vec3 colormapCubehelix(float x) {
  float xclamp = clamp(x, 0.0, 1.0);
  float angle = 2.0 * 3.1415926 * (4.0 / 3.0 + xclamp);
  float amp = xclamp * (1.0 - xclamp) / 2.0;
  vec3 result;
  float cosangle = cos(angle);
  float sinangle = sin(angle);
  result.r = -0.14861 * cosangle + 1.78277 * sinangle;
  result.g = -0.29227 * cosangle + -0.90649 * sinangle;
  result.b = 1.97294 * cosangle;
  result = clamp(xclamp + amp * result, 0.0, 1.0);
  return result;
}
` +
`vec3 colormapLhf(float x, vec3 mincolor, vec3 maxcolor) {
  float xclamp = clamp(x, 0.0, 1.0);
  float angle = 2.0 * 3.1415926 * (4.0 / 3.0 + xclamp);
  vec3 result;
  float cosangle = cos(angle);
  float sinangle = sin(angle);
  result.r = mincolor[0] + sinangle * (maxcolor[0]-mincolor[0]);
  result.g = mincolor[1] + cosangle * (maxcolor[1]-mincolor[1]);
  result.b = mincolor[2]*cosangle;
  return clamp(result, 0.0, 1.0);
}
` +
`vec3 colormapFull(float x, float r1, float g1, float b1, float r2, float g2, float b2) {
  float xclamp = clamp(x, 0.0, 1.0);
  vec3 result;
  result.r = r1 + xclamp * (r2-r1);
  result.g = g1 + xclamp * (g2-g1);
  result.b = b1 + xclamp * (b2-b1);
  return clamp(result, 0.0, 1.0);
}
`);
