/**
 * @license
 * Copyright 2017 Google Inc.
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
 * @file Facilities for creating tooltips.
 */

 import './message_box.css';

 import {RefCounted} from 'neuroglancer/util/disposable';
 import {removeFromParent} from 'neuroglancer/util/dom';
import { makeElement } from '../ui/layer_gene_table_tab';
 
 export class MessageBox extends RefCounted {
   element = document.createElement('div');
   constructor(title:string, content:Node) {
     super();
     const {element} = this;
     element.className = 'neuroglancer-messagebox';
     let subDiv = document.createElement('div');
     subDiv.classList.add('el-message-box');
     subDiv.appendChild(this.getTitle(title));
     subDiv.appendChild(this.getContent(content));
     subDiv.appendChild(this.getBoxBtn())
     element.appendChild(subDiv)
     document.body.appendChild(element);
   }
   getTitle(str:string){
     let ele = makeElement('div', ['el-message-box__header']);
     let title =  makeElement('h2', ['el-message-box__title'], {}, `<span>${str}</span>`);
     let closeBtn = makeElement('button', ['el-message-box__headerbtn'],{'type': 'button'}, `<i class="el-message-box__close el-icon-close"></i>`);
     ele.appendChild(title);
     ele.appendChild(closeBtn);
     closeBtn.addEventListener('click',()=>{
      this.element.style.display = 'none';
    })
    return ele
   }

   getContent(innerEle:Node){
    let ele = makeElement('div', ['el-message-box__content']);
    ele.appendChild(innerEle);
    return ele
   }
   getBoxBtn(){
    let ele = makeElement('div', ['el-message-box__btns'],{},`<button type="button" class="el-button el-button--default el-button--small el-button--primary "><span>确定</span></button>`)
    return ele
  } 
  disposed() {
    removeFromParent(this.element);
    super.disposed();
  }
 }
 