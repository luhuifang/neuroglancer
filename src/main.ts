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

/**
 * @file Main entry point for default neuroglancer viewer.
 */
import {setupDefaultViewer} from 'neuroglancer/ui/default_viewer_setup';
import { Viewer } from './neuroglancer/viewer';
export let viewer: Viewer;
window.addEventListener('DOMContentLoaded', () => {
  // setupDefaultViewer();
  viewer = setupDefaultViewer();
  let json = viewer.state.toJSON();
  console.log('setupDefaultViewer before: ', json);
  json.layout = 'xy';
  if(json.layers == undefined){
    json.layers = [{
      "type": "annotation",
      "source": "precomputed://http://10.225.5.208:5000/test/annotation/dnb/bin100",
      "tab": "source",
      "name": "bin100"
    }]
  }else{
    json.layers[0].source = 'precomputed://http://10.225.5.208:5000/test/annotation/dnb/bin100';
    json.layers[0].type = 'annotation';
  }
  console.log('setupDefaultViewer after: ', json);
  viewer.state.reset();
  viewer.state.restoreState(json);
  console.log('setupDefaultViewer: ', viewer.state.toJSON());
});
