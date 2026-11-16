import{r as e,t}from"./rolldown-runtime-XKyaHtl9.js";import{Gt as n,Ht as r,J as i,Kt as a,M as o,N as s,O as c,P as l,Qt as u,U as d,W as f,Y as p,Yt as m,Zt as h,_t as g,bt as _,dn as v,en as y,hn as b,j as x,mn as S,n as C,nt as w,on as T,rn as E,yt as D}from"./chat-DXzIvOEk.js";import"./assistant-Bl3dD0Kt.js";var ee=`ecodesk_pending_favorite`,te=`ecodesk_favorites_updated`;function O(e=l()?.id){if(!e)return[];let t=i().find(t=>String(t.id)===String(e));if(t&&Array.isArray(t.favorites))return[...t.favorites];try{let t=JSON.parse(localStorage.getItem(`ecodesk_favorites_${e}`)||`[]`);return Array.isArray(t)?t:[]}catch{return[]}}function ne(e,t=l()?.id){return!e||!t?!1:O(t).includes(String(e))}async function re(e,t=l()?.id){if(!e)return{isFavorite:!1,count:0,requiresAuth:!1};if(!t){try{sessionStorage.setItem(ee,String(e))}catch{}return{isFavorite:!1,count:0,requiresAuth:!0}}let n=String(e),r=O(t),a=!1;r.includes(n)?(r=r.filter(e=>e!==n),a=!1):(r.push(n),a=!0);try{localStorage.setItem(`ecodesk_favorites_${t}`,JSON.stringify(r))}catch{}let o=i(),s=o.findIndex(e=>String(e.id)===String(t));return s!==-1&&(o[s]={...o[s],favorites:r},g(o),D(o)),window.dispatchEvent(new CustomEvent(te,{detail:{userId:t,productId:n,isFavorite:a,count:r.length}})),k(r.length),{isFavorite:a,count:r.length,requiresAuth:!1}}async function ie(e,t=l()?.id){if(!e||!t)return;let n=String(e),r=O(t).filter(e=>e!==n);try{localStorage.setItem(`ecodesk_favorites_${t}`,JSON.stringify(r))}catch{}let a=i(),o=a.findIndex(e=>String(e.id)===String(t));o!==-1&&(a[o]={...a[o],favorites:r},g(a),D(a)),window.dispatchEvent(new CustomEvent(te,{detail:{userId:t,productId:n,isFavorite:!1,count:r.length}})),k(r.length)}async function ae(e){if(e)try{let t=sessionStorage.getItem(ee);if(t){if(sessionStorage.removeItem(ee),ne(t,e)){k(),sessionStorage.setItem(n,`Sản phẩm đã nằm trong danh sách yêu thích của bạn.`);return}(await re(t,e)).isFavorite&&sessionStorage.setItem(n,`Đã lưu sản phẩm vào danh sách yêu thích của bạn!`)}}catch{}}function oe(e=document){let t=l(),n=t?O(t.id):[];e.querySelectorAll(`[data-wishlist-btn]`).forEach(e=>{let t=e.dataset.productId,r=n.includes(String(t));e.classList.toggle(`is-active`,r),e.setAttribute(`title`,r?`Bỏ yêu thích`:`Thêm vào danh sách yêu thích`),e.setAttribute(`aria-label`,r?`Đã yêu thích`:`Thêm vào yêu thích`);let i=e.querySelector(`svg`);i&&(i.style.fill=r?`#ef4444`:`none`,i.style.stroke=r?`#ef4444`:`currentColor`)})}function k(e){let t=l(),n=e===void 0?t?O(t.id).length:0:e,r=document.getElementById(`wishlistCount`);r&&(r.textContent=String(n),r.style.display=n>0?`inline-flex`:`none`)}function se(){k(),document.addEventListener(`click`,async e=>{let t=e.target.closest(`[data-wishlist-btn]`);if(!t)return;e.preventDefault(),e.stopPropagation();let n=t.dataset.productId;if(n){t.disabled=!0;try{let e=await re(n,l()?.id);if(e.requiresAuth){T({next:`${window.location.pathname}${window.location.search}${window.location.hash}`,notice:`Bạn cần đăng nhập để thêm sản phẩm vào yêu thích hoặc xem sản phẩm yêu thích.`});return}t.classList.toggle(`is-active`,e.isFavorite),t.setAttribute(`title`,e.isFavorite?`Bỏ yêu thích`:`Thêm vào danh sách yêu thích`),t.setAttribute(`aria-label`,e.isFavorite?`Đã yêu thích`:`Thêm vào yêu thích`);let r=t.querySelector(`svg`);r&&(r.style.fill=e.isFavorite?`#ef4444`:`none`,r.style.stroke=e.isFavorite?`#ef4444`:`currentColor`),v(e.isFavorite?`Đã thêm vào danh sách yêu thích!`:`Đã bỏ khỏi danh sách yêu thích.`)}catch(e){console.error(`Lỗi khi cập nhật yêu thích:`,e),v(`Không thể cập nhật danh sách yêu thích. Vui lòng thử lại.`)}finally{t.disabled=!1}}}),window.addEventListener(te,e=>{let{productId:t,isFavorite:n,count:r}=e.detail;k(r),document.querySelectorAll(`[data-wishlist-btn][data-product-id="${t}"]`).forEach(e=>{e.classList.toggle(`is-active`,n),e.setAttribute(`title`,n?`Bỏ yêu thích`:`Thêm vào danh sách yêu thích`),e.setAttribute(`aria-label`,n?`Đã yêu thích`:`Thêm vào yêu thích`);let t=e.querySelector(`svg`);t&&(t.style.fill=n?`#ef4444`:`none`,t.style.stroke=n?`#ef4444`:`currentColor`)})}),oe()}var A=e(t(((e,t,n)=>{(function(n,r){typeof e==`object`&&typeof t==`object`?t.exports=r():typeof define==`function`&&define.amd?define([],r):typeof e==`object`?e.AOS=r():n.AOS=r()})(n,function(){return function(e){function t(r){if(n[r])return n[r].exports;var i=n[r]={exports:{},id:r,loaded:!1};return e[r].call(i.exports,i,i.exports,t),i.loaded=!0,i.exports}var n={};return t.m=e,t.c=n,t.p=`dist/`,t(0)}([function(e,t,n){function r(e){return e&&e.__esModule?e:{default:e}}var i=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e},a=r((r(n(1)),n(6))),o=r(n(7)),s=r(n(8)),c=r(n(9)),l=r(n(10)),u=r(n(11)),d=r(n(14)),f=[],p=!1,m={offset:120,delay:0,easing:`ease`,duration:400,disable:!1,once:!1,startEvent:`DOMContentLoaded`,throttleDelay:99,debounceDelay:50,disableMutationObserver:!1},h=function(){if(arguments.length>0&&arguments[0]!==void 0&&arguments[0]&&(p=!0),p)return f=(0,u.default)(f,m),(0,l.default)(f,m.once),f},g=function(){f=(0,d.default)(),h()},_=function(){f.forEach(function(e,t){e.node.removeAttribute(`data-aos`),e.node.removeAttribute(`data-aos-easing`),e.node.removeAttribute(`data-aos-duration`),e.node.removeAttribute(`data-aos-delay`)})},v=function(e){return e===!0||e===`mobile`&&c.default.mobile()||e===`phone`&&c.default.phone()||e===`tablet`&&c.default.tablet()||typeof e==`function`&&e()===!0};e.exports={init:function(e){m=i(m,e),f=(0,d.default)();var t=document.all&&!window.atob;return v(m.disable)||t?_():(m.disableMutationObserver||s.default.isSupported()||(console.info(`
      aos: MutationObserver is not supported on this browser,
      code mutations observing has been disabled.
      You may have to call "refreshHard()" by yourself.
    `),m.disableMutationObserver=!0),document.querySelector(`body`).setAttribute(`data-aos-easing`,m.easing),document.querySelector(`body`).setAttribute(`data-aos-duration`,m.duration),document.querySelector(`body`).setAttribute(`data-aos-delay`,m.delay),m.startEvent===`DOMContentLoaded`&&[`complete`,`interactive`].indexOf(document.readyState)>-1?h(!0):m.startEvent===`load`?window.addEventListener(m.startEvent,function(){h(!0)}):document.addEventListener(m.startEvent,function(){h(!0)}),window.addEventListener(`resize`,(0,o.default)(h,m.debounceDelay,!0)),window.addEventListener(`orientationchange`,(0,o.default)(h,m.debounceDelay,!0)),window.addEventListener(`scroll`,(0,a.default)(function(){(0,l.default)(f,m.once)},m.throttleDelay)),m.disableMutationObserver||s.default.ready(`[data-aos]`,g),f)},refresh:h,refreshHard:g}},function(e,t){},,,,,function(e,t){(function(t){function n(e,t,n){function r(t){var n=h,r=g;return h=g=void 0,w=t,v=e.apply(r,n)}function a(e){return w=e,y=setTimeout(u,t),T?r(e):v}function o(e){var n=e-b,r=e-w,i=t-n;return E?S(i,_-r):i}function c(e){var n=e-b,r=e-w;return b===void 0||n>=t||n<0||E&&r>=_}function u(){var e=C();return c(e)?d(e):void(y=setTimeout(u,o(e)))}function d(e){return y=void 0,D&&h?r(e):(h=g=void 0,v)}function f(){y!==void 0&&clearTimeout(y),w=0,h=b=g=y=void 0}function p(){return y===void 0?v:d(C())}function m(){var e=C(),n=c(e);if(h=arguments,g=this,b=e,n){if(y===void 0)return a(b);if(E)return y=setTimeout(u,t),r(b)}return y===void 0&&(y=setTimeout(u,t)),v}var h,g,_,v,y,b,w=0,T=!1,E=!1,D=!0;if(typeof e!=`function`)throw TypeError(l);return t=s(t)||0,i(n)&&(T=!!n.leading,E=`maxWait`in n,_=E?x(s(n.maxWait)||0,t):_,D=`trailing`in n?!!n.trailing:D),m.cancel=f,m.flush=p,m}function r(e,t,r){var a=!0,o=!0;if(typeof e!=`function`)throw TypeError(l);return i(r)&&(a=`leading`in r?!!r.leading:a,o=`trailing`in r?!!r.trailing:o),n(e,t,{leading:a,maxWait:t,trailing:o})}function i(e){var t=e===void 0?`undefined`:c(e);return!!e&&(t==`object`||t==`function`)}function a(e){return!!e&&(e===void 0?`undefined`:c(e))==`object`}function o(e){return(e===void 0?`undefined`:c(e))==`symbol`||a(e)&&b.call(e)==d}function s(e){if(typeof e==`number`)return e;if(o(e))return u;if(i(e)){var t=typeof e.valueOf==`function`?e.valueOf():e;e=i(t)?t+``:t}if(typeof e!=`string`)return e===0?e:+e;e=e.replace(f,``);var n=m.test(e);return n||h.test(e)?g(e.slice(2),n?2:8):p.test(e)?u:+e}var c=typeof Symbol==`function`&&typeof Symbol.iterator==`symbol`?function(e){return typeof e}:function(e){return e&&typeof Symbol==`function`&&e.constructor===Symbol&&e!==Symbol.prototype?`symbol`:typeof e},l=`Expected a function`,u=NaN,d=`[object Symbol]`,f=/^\s+|\s+$/g,p=/^[-+]0x[0-9a-f]+$/i,m=/^0b[01]+$/i,h=/^0o[0-7]+$/i,g=parseInt,_=(t===void 0?`undefined`:c(t))==`object`&&t&&t.Object===Object&&t,v=(typeof self>`u`?`undefined`:c(self))==`object`&&self&&self.Object===Object&&self,y=_||v||Function(`return this`)(),b=Object.prototype.toString,x=Math.max,S=Math.min,C=function(){return y.Date.now()};e.exports=r}).call(t,function(){return this}())},function(e,t){(function(t){function n(e,t,n){function i(t){var n=h,r=g;return h=g=void 0,w=t,v=e.apply(r,n)}function a(e){return w=e,y=setTimeout(u,t),T?i(e):v}function s(e){var n=e-C,r=e-w,i=t-n;return E?x(i,_-r):i}function l(e){var n=e-C,r=e-w;return C===void 0||n>=t||n<0||E&&r>=_}function u(){var e=S();return l(e)?d(e):void(y=setTimeout(u,s(e)))}function d(e){return y=void 0,D&&h?i(e):(h=g=void 0,v)}function f(){y!==void 0&&clearTimeout(y),w=0,h=C=g=y=void 0}function p(){return y===void 0?v:d(S())}function m(){var e=S(),n=l(e);if(h=arguments,g=this,C=e,n){if(y===void 0)return a(C);if(E)return y=setTimeout(u,t),i(C)}return y===void 0&&(y=setTimeout(u,t)),v}var h,g,_,v,y,C,w=0,T=!1,E=!1,D=!0;if(typeof e!=`function`)throw TypeError(c);return t=o(t)||0,r(n)&&(T=!!n.leading,E=`maxWait`in n,_=E?b(o(n.maxWait)||0,t):_,D=`trailing`in n?!!n.trailing:D),m.cancel=f,m.flush=p,m}function r(e){var t=e===void 0?`undefined`:s(e);return!!e&&(t==`object`||t==`function`)}function i(e){return!!e&&(e===void 0?`undefined`:s(e))==`object`}function a(e){return(e===void 0?`undefined`:s(e))==`symbol`||i(e)&&y.call(e)==u}function o(e){if(typeof e==`number`)return e;if(a(e))return l;if(r(e)){var t=typeof e.valueOf==`function`?e.valueOf():e;e=r(t)?t+``:t}if(typeof e!=`string`)return e===0?e:+e;e=e.replace(d,``);var n=p.test(e);return n||m.test(e)?h(e.slice(2),n?2:8):f.test(e)?l:+e}var s=typeof Symbol==`function`&&typeof Symbol.iterator==`symbol`?function(e){return typeof e}:function(e){return e&&typeof Symbol==`function`&&e.constructor===Symbol&&e!==Symbol.prototype?`symbol`:typeof e},c=`Expected a function`,l=NaN,u=`[object Symbol]`,d=/^\s+|\s+$/g,f=/^[-+]0x[0-9a-f]+$/i,p=/^0b[01]+$/i,m=/^0o[0-7]+$/i,h=parseInt,g=(t===void 0?`undefined`:s(t))==`object`&&t&&t.Object===Object&&t,_=(typeof self>`u`?`undefined`:s(self))==`object`&&self&&self.Object===Object&&self,v=g||_||Function(`return this`)(),y=Object.prototype.toString,b=Math.max,x=Math.min,S=function(){return v.Date.now()};e.exports=n}).call(t,function(){return this}())},function(e,t){function n(e){var t=void 0,r=void 0;for(t=0;t<e.length;t+=1)if(r=e[t],r.dataset&&r.dataset.aos||r.children&&n(r.children))return!0;return!1}function r(){return window.MutationObserver||window.WebKitMutationObserver||window.MozMutationObserver}function i(){return!!r()}function a(e,t){var n=window.document,i=new(r())(o);s=t,i.observe(n.documentElement,{childList:!0,subtree:!0,removedNodes:!0})}function o(e){e&&e.forEach(function(e){var t=Array.prototype.slice.call(e.addedNodes),r=Array.prototype.slice.call(e.removedNodes);if(n(t.concat(r)))return s()})}Object.defineProperty(t,"__esModule",{value:!0});var s=function(){};t.default={isSupported:i,ready:a}},function(e,t){function n(e,t){if(!(e instanceof t))throw TypeError(`Cannot call a class as a function`)}function r(){return navigator.userAgent||navigator.vendor||window.opera||``}Object.defineProperty(t,"__esModule",{value:!0});var i=function(){function e(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,`value`in r&&(r.writable=!0),Object.defineProperty(e,r.key,r)}}return function(t,n,r){return n&&e(t.prototype,n),r&&e(t,r),t}}(),a=/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i,o=/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i,s=/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i,c=/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i;t.default=new(function(){function e(){n(this,e)}return i(e,[{key:`phone`,value:function(){var e=r();return!(!a.test(e)&&!o.test(e.substr(0,4)))}},{key:`mobile`,value:function(){var e=r();return!(!s.test(e)&&!c.test(e.substr(0,4)))}},{key:`tablet`,value:function(){return this.mobile()&&!this.phone()}}]),e}())},function(e,t){Object.defineProperty(t,"__esModule",{value:!0});var n=function(e,t,n){var r=e.node.getAttribute(`data-aos-once`);t>e.position?e.node.classList.add(`aos-animate`):r!==void 0&&(r===`false`||!n&&r!==`true`)&&e.node.classList.remove(`aos-animate`)};t.default=function(e,t){var r=window.pageYOffset,i=window.innerHeight;e.forEach(function(e,a){n(e,i+r,t)})}},function(e,t,n){function r(e){return e&&e.__esModule?e:{default:e}}Object.defineProperty(t,"__esModule",{value:!0});var i=r(n(12));t.default=function(e,t){return e.forEach(function(e,n){e.node.classList.add(`aos-init`),e.position=(0,i.default)(e.node,t.offset)}),e}},function(e,t,n){function r(e){return e&&e.__esModule?e:{default:e}}Object.defineProperty(t,"__esModule",{value:!0});var i=r(n(13));t.default=function(e,t){var n=0,r=0,a=window.innerHeight,o={offset:e.getAttribute(`data-aos-offset`),anchor:e.getAttribute(`data-aos-anchor`),anchorPlacement:e.getAttribute(`data-aos-anchor-placement`)};switch(o.offset&&!isNaN(o.offset)&&(r=parseInt(o.offset)),o.anchor&&document.querySelectorAll(o.anchor)&&(e=document.querySelectorAll(o.anchor)[0]),n=(0,i.default)(e).top,o.anchorPlacement){case`top-bottom`:break;case`center-bottom`:n+=e.offsetHeight/2;break;case`bottom-bottom`:n+=e.offsetHeight;break;case`top-center`:n+=a/2;break;case`bottom-center`:n+=a/2+e.offsetHeight;break;case`center-center`:n+=a/2+e.offsetHeight/2;break;case`top-top`:n+=a;break;case`bottom-top`:n+=e.offsetHeight+a;break;case`center-top`:n+=e.offsetHeight/2+a}return o.anchorPlacement||o.offset||isNaN(t)||(r=t),n+r}},function(e,t){Object.defineProperty(t,"__esModule",{value:!0}),t.default=function(e){for(var t=0,n=0;e&&!isNaN(e.offsetLeft)&&!isNaN(e.offsetTop);)t+=e.offsetLeft-(e.tagName==`BODY`?0:e.scrollLeft),n+=e.offsetTop-(e.tagName==`BODY`?0:e.scrollTop),e=e.offsetParent;return{top:n,left:t}}},function(e,t){Object.defineProperty(t,"__esModule",{value:!0}),t.default=function(e){return e||=document.querySelectorAll(`[data-aos]`),Array.prototype.map.call(e,function(e){return{node:e}})}}])})}))(),1),ce=!1,le=[[`.section-head`,`fade-up`,0],[`.category-band`,`fade-up`,0],[`.visual-category`,`fade-up`,80],[`.new-product-card`,`fade-up`,60],[`.featured-card`,`fade-up`,60],[`.product-card`,`fade-up`,60],[`.combo-card`,`zoom-in`,100],[`.feature-grid > *`,`fade-up`,80],[`.story-grid > *`,`fade-up`,80],[`.spec-grid > *`,`fade-up`,60],[`.benefit-grid > *`,`fade-up`,60],[`.blog-grid > *`,`fade-up`,80],[`.consult-cta`,`fade-up`,0],[`.auth-visual, .auth-card, .auth-picker, .detail-grid > *, .cart-summary, .admin-feature-panel, .form-card`,`fade-right`,80],[`.scheduled-banner-content`,`fade-left`,0],[`.hero-copy`,`fade-right`,0],[`.hero-product-strip > a`,`flip-up`,100]];function ue(e=document){e?.querySelectorAll&&(le.forEach(([t,n,r],i)=>{e.querySelectorAll(t).forEach((e,t)=>{e.hasAttribute(`data-aos`)||(e.setAttribute(`data-aos`,n),e.setAttribute(`data-aos-duration`,String(700+i%3*100)),e.setAttribute(`data-aos-easing`,`ease-out-cubic`),e.setAttribute(`data-aos-offset`,`50`),r&&e.setAttribute(`data-aos-delay`,String(t%4*r)))})}),ce?A.default.refreshHard():(A.default.init({once:!1,mirror:!0,offset:50,duration:700,easing:`ease-out-cubic`}),window.AOS=A.default,ce=!0,window.addEventListener(`load`,()=>{A.default.refreshHard()})),setTimeout(()=>{A.default.refresh()},150))}if(!document.querySelector(`link[href*="search-modal.css"]`)){let e=document.createElement(`link`);e.rel=`stylesheet`,e.href=new URL(`/assets/search-modal-CPwvmYkB.css`,``+import.meta.url).href,document.head.append(e)}function j(e){return e?(e=String(e).toLowerCase().trim(),e=e.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,`a`),e=e.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,`e`),e=e.replace(/ì|í|ị|ỉ|ĩ/g,`i`),e=e.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,`o`),e=e.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,`u`),e=e.replace(/ỳ|ý|ỵ|ỷ|ỹ/g,`y`),e=e.replace(/đ/g,`d`),e=e.normalize(`NFD`).replace(/[\u0300-\u036f]/g,``),e):``}function de(e,t){if(!e||!t)return!1;let n=j(e);return n.includes(t)?!t.includes(` `)&&t.length<=4?n.split(/[\s,./\-_()+&]+/).some(e=>e.startsWith(t)):!0:!1}function fe(e,t){if(!e||!t)return!1;let n=j(e.name);if(n.includes(t)){if(!t.includes(` `)&&t.length<=4){if(n.split(/[\s,./\-_()+&]+/).some(e=>e.startsWith(t)))return!0}else return!0}let r=e.tags||[];for(let e of r){let n=j(e);if(n.includes(t)){if(!t.includes(` `)&&t.length<=4){if(n.split(/[\s,./\-_()+&]+/).some(e=>e.startsWith(t)))return!0}else return!0}}return!1}function M(e){return String(e||``).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#039;`)}var pe=!1,N=null,P=null,F=null,I=null,me=null,he=null,L=null,ge=null,R=null,_e=[`Bàn nâng hạ`,`Ghế công thái học`,`Đèn & ánh sáng`,`Combo setup`,`Phụ kiện setup`],ve=[{name:`Chính sách bảo hành`,url:`./payment-support.html#faqSection`},{name:`Chính sách giao hàng`,url:`./payment-support.html#faqSection`},{name:`Điều khoản và chính sách chung cho Khách hàng doanh nghiệp (B2B)`,url:`./payment-support.html#faqSection`},{name:`Hỗ trợ khách hàng`,url:`./payment-support.html`},{name:`Tất cả sản phẩm`,url:`./products.html`}];function ye(){if(document.getElementById(`ecodeskSearchModal`))return;let e=document.createElement(`div`);e.id=`ecodeskSearchModal`,e.className=`ecodesk-search-backdrop`,e.setAttribute(`role`,`dialog`),e.setAttribute(`aria-modal`,`true`),e.setAttribute(`aria-label`,`Tìm kiếm sản phẩm EcoDesk`),e.setAttribute(`aria-hidden`,`true`),e.innerHTML=`
    <!-- Top Announcement Bar -->
    <div class="search-top-announcement">Miễn phí vận chuyển và lắp đặt tại Hồ Chí Minh</div>

    <!-- Full-Width White Header Bar -->
    <div class="search-white-header-strip">
      <div class="search-header-container">
        <div class="search-input-box" id="modalSearchBox">
          <label class="search-floating-label" for="modalSearchInput">Tìm kiếm</label>
          <div class="search-input-inner">
            <input 
              type="text" 
              id="modalSearchInput" 
              class="search-input-field" 
              placeholder="" 
              autocomplete="off" 
              spellcheck="false" 
              aria-label="Tìm kiếm sản phẩm hoặc nội dung"
            >
            <button type="button" id="modalSearchClear" class="search-clear-circle-btn" aria-label="Xóa nội dung" title="Xóa" hidden>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div class="search-input-divider" id="modalSearchDivider" hidden aria-hidden="true"></div>
            <button type="button" id="modalSearchSubmit" class="search-submit-icon-btn" aria-label="Tìm kiếm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
        </div>
        <button type="button" id="modalSearchClose" class="search-modal-close-icon" aria-label="Đóng tìm kiếm" title="Đóng (ESC)">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- Dimmed Lower Area with Search Dropdown -->
    <div class="search-body-overlay" id="modalSearchOverlay">
      <div class="search-dropdown-wrapper">
        <div class="search-dropdown-panel" id="modalSearchDropdown"></div>
      </div>
    </div>
  `,document.body.append(e),N=e,ge=e.querySelector(`#modalSearchOverlay`),P=e.querySelector(`#modalSearchInput`),F=e.querySelector(`#modalSearchClear`),I=e.querySelector(`#modalSearchDivider`),me=e.querySelector(`#modalSearchClose`),he=e.querySelector(`#modalSearchSubmit`),L=e.querySelector(`#modalSearchDropdown`),me.addEventListener(`click`,z),F.addEventListener(`click`,()=>{P.value=``,P.focus(),F.hidden=!0,I.hidden=!0,Ce()}),he.addEventListener(`click`,()=>{let e=P.value.trim();e?window.location.href=`./products.html?search=${encodeURIComponent(e)}`:P.focus()}),ge.addEventListener(`click`,e=>{L.contains(e.target)||z()}),P.addEventListener(`input`,Se),P.addEventListener(`keydown`,be),document.addEventListener(`keydown`,e=>{e.key===`Escape`&&N.classList.contains(`is-open`)&&z(),(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()===`k`&&(e.preventDefault(),De())})}function be(e){let t=P.value.trim();e.key===`Enter`&&(e.preventDefault(),t&&(window.location.href=`./products.html?search=${encodeURIComponent(t)}`))}var xe=null;function Se(){let e=P.value,t=e.length>0;F.hidden=!t,I.hidden=!t,clearTimeout(xe),xe=setTimeout(()=>{e.trim()?(L.hidden=!1,we(e.trim())):Ce()},40)}function Ce(){L.hidden=!1;let e=f().filter(e=>!e.isDraft&&e.status!==`Bản nháp`&&e.status!==`Ngừng kinh doanh`).slice(0,6);L.innerHTML=`
    <div class="search-content-grid">
      <!-- Left Column: GỢI Ý & TRANG -->
      <div class="search-col-meta">
        <div class="search-section-block">
          <div class="search-section-label">GỢI Ý</div>
          <ul class="search-simple-list">
            ${_e.slice(0,4).map(e=>`
              <li>
                <button type="button" class="search-text-item" data-fill-search="${M(e)}">
                  ${M(e)}
                </button>
              </li>
            `).join(``)}
          </ul>
        </div>

        <div class="search-section-block">
          <div class="search-section-label">TRANG</div>
          <ul class="search-simple-list">
            ${ve.slice(0,4).map(e=>`
              <li>
                <a href="${e.url}" class="search-page-item">
                  ${M(e.name)}
                </a>
              </li>
            `).join(``)}
          </ul>
        </div>
      </div>

      <!-- Right Column: SẢN PHẨM -->
      <div class="search-col-products">
        <div class="search-section-label">SẢN PHẨM</div>
        <div class="search-product-items">
          ${e.map(e=>Te(e)).join(``)}
        </div>
      </div>
    </div>

    <!-- Bottom Footer Row -->
    <a href="./products.html" class="search-footer-row">
      <span class="search-footer-query">Xem tất cả sản phẩm EcoDesk</span>
      <span class="search-footer-arrow" aria-hidden="true">→</span>
    </a>
  `,Ee()}function we(e){let t=j(e),n=s(),r=f(),i=[];_e.forEach(e=>{de(e,t)&&!i.includes(e)&&i.push(e)}),n.forEach(e=>{de(e.name,t)&&!i.includes(e.name)&&i.push(e.name)});let a=ve.filter(e=>de(e.name,t)),o=r.filter(e=>e.isDraft||e.status===`Bản nháp`||e.status===`Ngừng kinh doanh`?!1:fe(e,t));o.length===0&&i.length===0&&a.length===0?(L.innerHTML=`
      <div class="search-empty-state">
        <div class="search-empty-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="12"></line>
            <line x1="11" y1="16" x2="11.01" y2="16"></line>
          </svg>
        </div>
        <h4 class="search-empty-title">Không tìm thấy kết quả nào cho "${M(e)}"</h4>
        <p class="search-empty-desc">Vui lòng kiểm tra lại chính tả hoặc chọn các danh mục gợi ý bên dưới.</p>
        <div class="search-empty-chips">
          ${_e.slice(0,4).map(e=>`
            <button type="button" class="search-chip-btn" data-fill-search="${M(e)}">${M(e)}</button>
          `).join(``)}
        </div>
      </div>
    `,Ee()):(L.innerHTML=`
    <div class="search-content-grid">
      <!-- Left Column: GỢI Ý & TRANG -->
      <div class="search-col-meta">
        ${i.length>0?`
          <div class="search-section-block">
            <div class="search-section-label">GỢI Ý</div>
            <ul class="search-simple-list">
              ${i.map(e=>`
                <li>
                  <button type="button" class="search-text-item" data-fill-search="${M(e)}">
                    ${M(e)}
                  </button>
                </li>
              `).join(``)}
            </ul>
          </div>
        `:``}

        ${a.length>0?`
          <div class="search-section-block">
            <div class="search-section-label">TRANG</div>
            <ul class="search-simple-list">
              ${a.map(e=>`
                <li>
                  <a href="${e.url}" class="search-page-item">
                    ${M(e.name)}
                  </a>
                </li>
              `).join(``)}
            </ul>
          </div>
        `:``}
      </div>

      <!-- Right Column: SẢN PHẨM -->
      <div class="search-col-products">
        <div class="search-section-label">SẢN PHẨM</div>
        <div class="search-product-items">
          ${o.length>0?o.slice(0,6).map(e=>Te(e)).join(``):`
            <div class="search-no-products">
              Không có sản phẩm nào khớp với từ khóa này.
            </div>
          `}
        </div>
      </div>
    </div>

    <!-- Bottom Footer Row: Tìm kiếm "[query]" -->
    <a href="./products.html?search=${encodeURIComponent(e)}" class="search-footer-row">
      <span class="search-footer-query">Tìm kiếm "${M(e)}"</span>
      <span class="search-footer-arrow" aria-hidden="true">→</span>
    </a>
  `,Ee())}function Te(e){return`
    <a href="./detail.html?id=${e.id}" class="search-product-row" data-product-id="${e.id}">
      <div class="search-product-thumb">
        <img src="${e.image}" alt="${M(e.name)}" loading="lazy">
      </div>
      <span class="search-product-title">${M(e.name)}</span>
    </a>
  `}function Ee(){L.querySelectorAll(`[data-fill-search]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.getAttribute(`data-fill-search`);P.value=t,F.hidden=!1,I.hidden=!1,L.hidden=!1,P.focus(),we(t)})})}function De(){N||ye(),R=document.activeElement,N.classList.add(`is-open`),N.setAttribute(`aria-hidden`,`false`),document.body.classList.add(`search-modal-open`),P.value.trim()?(L.hidden=!1,F.hidden=!1,I.hidden=!1,we(P.value.trim())):(F.hidden=!0,I.hidden=!0,Ce()),setTimeout(()=>{P.focus(),P.select()},40)}function z(){N&&(N.classList.remove(`is-open`),N.setAttribute(`aria-hidden`,`true`),document.body.classList.remove(`search-modal-open`),R&&typeof R.focus==`function`&&R.focus())}async function Oe(){pe||(pe=!0,await p(),ye(),document.querySelectorAll(`.header-search, [data-open-search]`).forEach(e=>{e.addEventListener(`click`,e=>{e.preventDefault(),De()})}))}document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,Oe):Oe();var B=window.location.pathname.toLowerCase(),ke=B.includes(`admin.html`)||B.includes(`add.html`)||B.includes(`edit.html`)||E(B),V=null,Ae=``,H=null,U=null,W=null;function je(){if(!document.getElementById(`cartDrawerCriticalGuard`)){let e=document.createElement(`style`);e.id=`cartDrawerCriticalGuard`,e.textContent=`.cart-drawer-overlay[hidden],.cart-drawer-overlay:not(.is-open):not(.is-closing){display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important;}`,document.head.append(e)}if(W)return W;let e=document.querySelector(`link[href*="cart-drawer.css"]`),t=e||document.createElement(`link`);return e||(t.rel=`stylesheet`,t.href=new URL(`/assets/cart-drawer-CPSFkSb2.css`,``+import.meta.url).href,document.head.append(t)),W=new Promise(e=>{if(t.sheet){e();return}let n=()=>e();t.addEventListener(`load`,n,{once:!0}),t.addEventListener(`error`,n,{once:!0}),window.setTimeout(n,1500)}),W}function Me(){U&&=(window.clearTimeout(U),null);let e=document.getElementById(`cartDrawerOverlay`);e&&(e.classList.remove(`is-open`,`is-closing`),e.setAttribute(`aria-hidden`,`true`),e.hidden=!0),document.body&&(document.body.style.overflow=Ae||``),H=null}ke||Ne();function Ne(){if(je(),!document.getElementById(`cartDrawerOverlay`)){let e=`
      <div id="cartDrawerOverlay" class="cart-drawer-overlay" aria-hidden="true" hidden>
        <div class="cart-drawer-backdrop" id="cartDrawerBackdrop" tabindex="-1"></div>
        <div class="cart-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="cartDrawerTitle" id="cartDrawerPanel">
          <header class="cart-drawer-header">
            <div class="cart-drawer-title-wrap">
              <h2 class="cart-drawer-title" id="cartDrawerTitle">Giỏ hàng</h2>
              <span class="cart-drawer-badge" id="cartDrawerItemCount">0</span>
            </div>
            <button type="button" class="cart-drawer-close" id="cartDrawerCloseBtn" aria-label="Đóng giỏ hàng">${b(`x`,{size:20,strokeWidth:2})}</button>
          </header>
          <div class="cart-drawer-body" id="cartDrawerBody">
            <div class="cart-drawer-loading">
              <div class="cart-drawer-spinner"></div>
              <span>Đang tải thông tin giỏ hàng...</span>
            </div>
          </div>
          <footer class="cart-drawer-footer" id="cartDrawerFooter">
            <div class="cart-drawer-subtotal-row">
              <span class="cart-drawer-subtotal-label">Tạm tính:</span>
              <span class="cart-drawer-subtotal-val" id="cartDrawerSubtotal">0₫</span>
            </div>
            <div class="cart-drawer-note">
              Đã bao gồm VAT nếu có • Phí vận chuyển và mã ưu đãi sẽ được tính tại bước thanh toán.
            </div>
            <div id="cartDrawerErrorAlert" class="cart-drawer-error-alert" style="display: none;"></div>
            <button type="button" class="cart-drawer-checkout-btn" id="cartDrawerCheckoutBtn">
              <span>Tiến hành thanh toán</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
            <a href="./cart.html" class="cart-drawer-view-full" id="cartDrawerViewFullBtn">Xem giỏ hàng đầy đủ</a>
          </footer>
        </div>
      </div>
    `;document.body.insertAdjacentHTML(`beforeend`,e)}Me(),Fe(),K()}async function Pe(){if(ke)return;let e=document.getElementById(`cartDrawerOverlay`);e&&(U&&=(window.clearTimeout(U),null),await je(),V=document.activeElement,e.classList.contains(`is-open`)||(Ae=document.body.style.overflow),document.body.style.overflow=`hidden`,e.hidden=!1,e.classList.remove(`is-closing`),e.offsetWidth,e.classList.add(`is-open`),e.setAttribute(`aria-hidden`,`false`),q(),window.setTimeout(()=>{let e=document.getElementById(`cartDrawerCloseBtn`);e&&e.focus()},100))}function G(){let e=document.getElementById(`cartDrawerOverlay`);if(!(!e||!e.classList.contains(`is-open`)&&e.hidden)&&(U&&=(window.clearTimeout(U),null),e.classList.remove(`is-open`),e.classList.add(`is-closing`),e.setAttribute(`aria-hidden`,`true`),document.body.style.overflow=Ae||``,H=null,U=window.setTimeout(()=>{e.classList.contains(`is-open`)||(e.classList.remove(`is-closing`),e.hidden=!0),U=null},340),V&&typeof V.focus==`function`))try{V.focus()}catch{}}function K(){let e=o();document.querySelectorAll(`#cartCount, .cart-pill strong, .cart-pill-count`).forEach(t=>{t.textContent=e}),document.querySelectorAll(`.cart-pill`).forEach(t=>{if(!t.querySelector(`#cartCount`)&&!t.querySelector(`strong`)){let n=document.createElement(`strong`);n.id=`cartCount`,n.textContent=e,t.appendChild(n)}});let t=document.getElementById(`cartDrawerItemCount`);t&&(t.textContent=e)}function q(){let e=document.getElementById(`cartDrawerBody`),t=document.getElementById(`cartDrawerFooter`),n=document.getElementById(`cartDrawerSubtotal`),r=document.getElementById(`cartDrawerCheckoutBtn`),i=document.getElementById(`cartDrawerErrorAlert`),a=document.getElementById(`cartDrawerItemCount`);if(!e)return;let o=x(),s=f(),c=o.reduce((e,t)=>e+(Number(t.quantity)||0),0);if(a&&(a.textContent=c),K(),o.length===0){e.innerHTML=`
      <div class="cart-drawer-empty">
        <div class="cart-drawer-empty-icon" style="display:flex; justify-content:center; color:#94a3b8; margin-bottom:12px;">${b(`shopping-bag`,{size:48,strokeWidth:1.5})}</div>
        <h3 class="cart-drawer-empty-title">Giỏ hàng của bạn đang trống</h3>
        <p class="cart-drawer-empty-desc">
          Hãy khám phá những giải pháp công thái học và phụ kiện setup cao cấp của EcoDesk.
        </p>
        <a href="./products.html" class="cart-drawer-empty-btn" id="cartDrawerContinueShoppingBtn">
          Khám phá sản phẩm
        </a>
      </div>
    `,t&&(t.style.display=`none`);return}t&&(t.style.display=`block`);let l=0,u=!1,p=[];e.innerHTML=`<div class="cart-drawer-list">${o.map((e,t)=>{let n=s.find(t=>String(t.id)===String(e.productId)),r=`${e.productId}_${e.variantId||`base`}`;if(!n)return`
        <div class="cart-drawer-item">
          <div class="cart-drawer-item-thumb">
            <img src="./images/setup-ban-govi.png" alt="Sản phẩm không tồn tại">
          </div>
          <div class="cart-drawer-item-content">
            <h4 class="cart-drawer-item-title" style="color: #94a3b8;">Sản phẩm không còn kinh doanh</h4>
            <div class="cart-drawer-item-bottom">
              <button type="button" class="cart-drawer-item-remove" data-drawer-remove="${h(r)}" title="Xóa khỏi giỏ" style="display:inline-flex; align-items:center; gap:4px;">${b(`trash-2`,{size:13,strokeWidth:2})} Xóa</button>
            </div>
          </div>
        </div>
      `;let i=null;e.variantId&&Array.isArray(n.variants)&&(i=n.variants.find(t=>String(t.id)===String(e.variantId)||String(t.sku)===String(e.variantId)));let a=Number(i?i.stock:n.stock||0),o=i&&i.price!=null?Number(i.price):e.price!=null&&!isNaN(e.price)?Number(e.price):Number(n.price),c=d({...n,price:o},new Date,i),f=c.price*e.quantity;l+=f;let m=e.image||i&&i.image||n.image||`./images/setup-ban-govi.png`,g=e.variantName||i&&i.name||``,_=a<=0,v=e.quantity>a&&!_;_&&(u=!0,p.push(`"${n.name}${g?` (${g})`:``}" đã hết hàng`));let x=H===r;return`
      <article class="cart-drawer-item" data-item-key="${h(r)}">
        <a href="./detail.html?id=${h(n.id)}" class="cart-drawer-item-thumb" title="${h(n.name)}">
          <img src="${h(m)}" alt="${h(n.name)}" loading="lazy">
        </a>
        <div class="cart-drawer-item-content">
          <div class="cart-drawer-item-head">
            <a href="./detail.html?id=${h(n.id)}" class="cart-drawer-item-title" title="${h(n.name)}">
              ${h(n.name)}
            </a>
            <button type="button" class="cart-drawer-item-remove" data-drawer-remove-trigger="${h(r)}" aria-label="Xóa ${h(n.name)}" title="Xóa sản phẩm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>

          ${g?`
            <div class="cart-drawer-item-variant">
              ${h(g)}
            </div>
          `:``}

          <div class="cart-drawer-item-bottom">
            <div class="cart-drawer-qty-wrap" role="group" aria-label="Điều chỉnh số lượng">
              <button type="button" class="cart-drawer-qty-btn minus" data-drawer-action="decrease" data-product-id="${h(n.id)}" data-variant-id="${h(e.variantId||``)}" ${e.quantity<=1?`disabled`:``} aria-label="Giảm 1">
                −
              </button>
              <span class="cart-drawer-qty-val" aria-live="polite">${e.quantity}</span>
              <button type="button" class="cart-drawer-qty-btn plus" data-drawer-action="increase" data-product-id="${h(n.id)}" data-variant-id="${h(e.variantId||``)}" ${e.quantity>=a||_?`disabled`:``} aria-label="Tăng 1">
                +
              </button>
            </div>

            <div class="cart-drawer-item-pricing">
              ${c.percent>0?`
                <del class="cart-drawer-item-orig-price">${y(c.original*e.quantity)}</del>
              `:``}
              <span class="cart-drawer-item-price ${c.percent>0?`is-sale`:``}">
                ${y(f)}
              </span>
            </div>
          </div>

          ${_?`
            <div class="cart-drawer-item-warn">
              <span style="display:inline-flex; vertical-align:-2px; margin-right:4px;">${b(`alert-triangle`,{size:14,strokeWidth:2})}</span> Mẫu này hiện đã hết hàng trong kho. Vui lòng xóa để thanh toán.
            </div>
          `:v?`
            <div class="cart-drawer-item-warn">
              <span style="display:inline-flex; vertical-align:-2px; margin-right:4px;">${b(`alert-triangle`,{size:14,strokeWidth:2})}</span> Tồn kho chỉ còn ${a} chiếc. Đã giới hạn số lượng.
            </div>
          `:``}

          ${x?`
            <div class="cart-drawer-confirm-delete">
              <span>Xóa sản phẩm này khỏi giỏ?</span>
              <div class="cart-drawer-confirm-actions">
                <button type="button" class="cart-drawer-confirm-btn cancel" data-drawer-delete-cancel="${h(r)}">Hủy</button>
                <button type="button" class="cart-drawer-confirm-btn confirm" data-drawer-delete-confirm="${h(r)}" data-product-id="${h(n.id)}" data-variant-id="${h(e.variantId||``)}">Xóa</button>
              </div>
            </div>
          `:``}
        </div>
      </article>
    `}).join(``)}</div>`,n&&(n.textContent=y(l)),u?(r&&(r.disabled=!0,r.setAttribute(`title`,`Vui lòng xóa sản phẩm hết hàng để tiếp tục thanh toán`)),i&&(i.style.display=`flex`,i.innerHTML=`<span style="display:inline-flex; align-items:center; gap:6px; flex-shrink:0;">${b(`alert-triangle`,{size:16,strokeWidth:1.8})}</span> <span>${p.join(`, `)}. Quý khách vui lòng xóa khỏi giỏ để tiến hành thanh toán.</span>`)):(r&&(r.disabled=!1,r.removeAttribute(`title`)),i&&(i.style.display=`none`,i.innerHTML=``))}function Fe(){let e=document.getElementById(`cartDrawerOverlay`),t=document.getElementById(`cartDrawerBackdrop`),n=document.getElementById(`cartDrawerCloseBtn`),r=document.getElementById(`cartDrawerCheckoutBtn`),i=document.getElementById(`cartDrawerViewFullBtn`);t&&t.addEventListener(`click`,G),n&&n.addEventListener(`click`,G),document.addEventListener(`keydown`,t=>{t.key===`Escape`&&e&&e.classList.contains(`is-open`)&&G()}),document.addEventListener(`click`,e=>{e.target.closest(`.cart-pill, [data-open-cart]`)&&(e.preventDefault(),Pe())});let a=document.getElementById(`cartDrawerBody`);a&&a.addEventListener(`click`,e=>{let t=e.target.closest(`[data-drawer-action]`);if(t){let e=t.dataset.drawerAction,n=t.dataset.productId,r=t.dataset.variantId||null,i=x().find(e=>String(e.productId)===String(n)&&String(e.variantId||``)===String(r||``));if(i){let t=e===`increase`?1:-1,a=i.quantity+t;a>=1&&(_(n,a,r),q(),window.dispatchEvent(new CustomEvent(`ecodesk-cart-updated`)))}return}let n=e.target.closest(`[data-drawer-remove-trigger]`);if(n){H=n.dataset.drawerRemoveTrigger,q();return}if(e.target.closest(`[data-drawer-delete-cancel]`)){H=null,q();return}let r=e.target.closest(`[data-drawer-delete-confirm]`);if(r){let e=r.dataset.productId,t=r.dataset.variantId||null;_(e,0,t),H=null,q(),v(`Đã xóa sản phẩm khỏi giỏ hàng.`),window.dispatchEvent(new CustomEvent(`ecodesk-cart-updated`))}else e.target.closest(`#cartDrawerContinueShoppingBtn`)&&G()}),r&&r.addEventListener(`click`,()=>{let e=x(),t=f();if(e.length===0)v(`Giỏ hàng đang trống, vui lòng chọn sản phẩm.`);else{for(let n of e){let e=t.find(e=>String(e.id)===String(n.productId));if(!e){v(`Trong giỏ có sản phẩm không tồn tại. Vui lòng kiểm tra lại.`);return}let r=null;if(n.variantId&&Array.isArray(e.variants)&&(r=e.variants.find(e=>String(e.id)===String(n.variantId)||String(e.sku)===String(n.variantId))),Number(r?r.stock:e.stock||0)<=0){let t=r?`${e.name} (${r.name})`:e.name;v(`Sản phẩm "${t}" hiện đã hết hàng. Vui lòng xóa khỏi giỏ để tiếp tục.`),q();return}}G(),window.location.href=`./checkout.html`}}),i&&i.addEventListener(`click`,()=>{G()}),window.addEventListener(`ecodesk-cart-updated`,()=>{K(),e&&e.classList.contains(`is-open`)&&q()}),window.addEventListener(`storage`,t=>{t.key&&t.key.startsWith(`ecodesk_cart`)&&(K(),e&&e.classList.contains(`is-open`)&&q())}),window.addEventListener(`pagehide`,Me),window.addEventListener(`pageshow`,()=>{Me(),K()})}typeof window<`u`&&(window.openEcoDeskCartDrawer=Pe,window.closeEcoDeskCartDrawer=G,window.syncEcoDeskCartCounts=K);var Ie=document.createElement(`link`);Ie.rel=`stylesheet`,Ie.href=new URL(`/assets/interface-DYLtzK7q.css`,``+import.meta.url).href,document.head.append(Ie);function Le(){S(document)}function Re(e,t,n=!1){if(e.querySelector(`[data-lucide], .lucide`))return;let r=e.textContent.trim(),i=document.createElement(`i`);i.dataset.lucide=t;let a=document.createElement(`span`);a.className=n?`control-label`:``,a.append(...e.childNodes),e.append(i,a),e.classList.add(`with-icon`),e.title||=r,e.getAttribute(`aria-label`)||e.setAttribute(`aria-label`,r)}var J=document.querySelector(`.header-inner`),Y=J?.querySelector(`.nav`);if(J&&Y){if(Y.id=`primary-navigation`,Y.setAttribute(`aria-label`,`Điều hướng chính`),!Y.querySelector(`[data-drawer-utilities]`)){let e=document.createElement(`div`);e.className=`mobile-drawer-utilities`,e.setAttribute(`data-drawer-utilities`,``),e.innerHTML=E()?`<div class="drawer-auth-slot" data-drawer-auth></div>`:`
      <div class="drawer-quick-links">
        <a class="drawer-utility-btn" href="./account.html#wishlist">
          <i data-lucide="heart"></i>
          <span>Sản phẩm yêu thích</span>
          <span class="drawer-badge" id="drawerWishlistCount" style="display:none;">0</span>
        </a>
        <button type="button" class="drawer-utility-btn" id="drawerNotifBtn">
          <i data-lucide="bell"></i>
          <span>Thông báo đơn hàng</span>
          <span class="drawer-badge" id="drawerNotifCount" style="display:none;">0</span>
        </button>
      </div>
      <div class="drawer-auth-slot" data-drawer-auth></div>
    `,Y.append(e)}let e=document.createElement(`button`);e.type=`button`,e.className=`mobile-menu-toggle`,e.setAttribute(`aria-controls`,Y.id),e.setAttribute(`aria-expanded`,`false`),e.setAttribute(`aria-label`,`Mở menu`),e.innerHTML=`<i data-lucide="menu"></i>`,J.append(e);function t(){J.classList.remove(`menu-open`),e.setAttribute(`aria-expanded`,`false`),e.setAttribute(`aria-label`,`Mở menu`)}e.addEventListener(`click`,()=>{let t=J.classList.toggle(`menu-open`);e.setAttribute(`aria-expanded`,String(t)),e.setAttribute(`aria-label`,t?`Đóng menu`:`Mở menu`)}),document.addEventListener(`keydown`,e=>{if(e.key!==`Escape`)return;t();let n=Y.querySelector(`.product-menu-trigger`);n?.parentElement.classList.remove(`products-open`),n?.setAttribute(`aria-expanded`,`false`)}),document.addEventListener(`click`,e=>{J.contains(e.target)||t()});let n=Y.querySelector(`.product-menu-trigger`);if(n){let e=Array.from(n.querySelectorAll(`span`)).find(e=>e.textContent.trim()===`⌄`||e.classList.contains(`menu-arrow`));e&&(e.className=`menu-arrow`,e.setAttribute(`aria-hidden`,`true`),e.innerHTML=`<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5L5 6.5L8 3.5"/></svg>`),n.setAttribute(`aria-expanded`,`false`),n.setAttribute(`aria-haspopup`,`true`);let t=n.parentElement,r=e=>{t.classList.toggle(`products-open`,e),n.setAttribute(`aria-expanded`,String(e))},i;t.addEventListener(`mouseenter`,()=>{window.clearTimeout(i),window.matchMedia(`(max-width: 1080px)`).matches||r(!0)}),t.addEventListener(`mouseleave`,()=>{window.matchMedia(`(max-width: 1080px)`).matches||(i=window.setTimeout(()=>r(!1),350))}),t.querySelector(`.product-mega`)?.addEventListener(`mouseenter`,()=>{window.clearTimeout(i),r(!0)}),t.addEventListener(`focusin`,()=>{window.matchMedia(`(max-width: 1080px)`).matches||r(!0)}),t.addEventListener(`focusout`,e=>{!t.contains(e.relatedTarget)&&!window.matchMedia(`(max-width: 1080px)`).matches&&r(!1)}),n.addEventListener(`click`,e=>{window.matchMedia(`(max-width: 1080px)`).matches&&(e.preventDefault(),r(!t.classList.contains(`products-open`)))}),document.addEventListener(`click`,e=>{t.contains(e.target)||r(!1)}),Y.querySelectorAll(`.product-mega a`).forEach(e=>{e.addEventListener(`click`,()=>r(!1))})}}var ze=[[`.nav > a[href*='index.html']`,`house`],[`.product-menu-trigger, .nav > a[href*='products.html']`,`armchair`],[`.nav > a[href*='customer-orders.html']`,`package`],[`.nav > a[href*='contact.html'], .nav > a[href*='payment-support.html']`,`headset`],[`.nav > a[href*='admin.html']`,`settings-2`],[`.header-search`,`search`,!0],[`.cart-pill`,`shopping-bag`,!0],[`.auth-link[href*='login.html']`,`user-round`,!0],[`.auth-link[href*='register.html']`,`user-round-plus`,!0],[`.auth-link.account-link`,`user-round`,!0],[`button.auth-link`,`log-out`,!0],[`.hero-actions .btn`,`arrow-up-right`],[`.hero-actions .btn-outline`,`sparkles`],[`.section-head > a`,`arrow-right`],[`.category-btn`,`layers-2`],[`.filters button[type='submit'], .search-button`,`search`],[`#addCartBtn`,`shopping-bag`],[`.featured-foot a, .product-foot a`,`arrow-up-right`],[`.hero-product-strip a`,`arrow-up-right`],[`.cart-continue`,`arrow-left`],[`.checkout-button`,`credit-card`],[`#authForm[data-mode='login'] button[type='submit'], .form-card button[type='submit']`,`log-in`]];function Be(){let e=document.getElementById(`wishlistCount`),t=document.getElementById(`drawerWishlistCount`);e&&t&&(t.textContent=e.textContent||`0`,t.style.display=e.style.display);let n=document.getElementById(`notifCountBadge`),r=document.getElementById(`drawerNotifCount`);n&&r&&(r.textContent=n.textContent||`0`,r.style.display=n.style.display)}function Ve(e=document){e&&typeof e.querySelectorAll==`function`&&(e.querySelectorAll(`.password-toggle-btn[data-toggle-password]`).forEach(e=>{let t=document.getElementById(e.dataset.togglePassword);t&&(t.type=`password`),e.setAttribute(`aria-pressed`,`false`),e.setAttribute(`aria-label`,e.dataset.showLabel||`Hiện mật khẩu`),e.innerHTML=`<i data-lucide="eye"></i>`}),Le())}function He(){typeof document<`u`&&document.documentElement.dataset.ecodeskPwdToggleBound!==`1`&&(document.documentElement.dataset.ecodeskPwdToggleBound=`1`,document.addEventListener(`click`,e=>{let t=e.target.closest(`.password-toggle-btn[data-toggle-password]`);if(!t)return;let n=document.getElementById(t.dataset.togglePassword);if(!n)return;t.dataset.showLabel||(t.dataset.showLabel=t.getAttribute(`aria-label`)||`Hiện mật khẩu`);let r=n.type===`password`;n.type=r?`text`:`password`,t.setAttribute(`aria-pressed`,r?`true`:`false`),t.setAttribute(`aria-label`,r?t.dataset.showLabel.replace(/^Hiện/,`Ẩn`):t.dataset.showLabel),t.innerHTML=`<i data-lucide="${r?`eye-off`:`eye`}"></i>`,Le(),n.focus({preventScroll:!0})}))}function X(){for(let[e,t,n]of ze)document.querySelectorAll(e).forEach(e=>Re(e,t,n));Be(),Le()}He();var Ue=!1;typeof document<`u`&&document.body&&new MutationObserver(()=>{Ue||(Ue=!0,requestAnimationFrame(()=>{Ue=!1,X()}))}).observe(document.body,{childList:!0,subtree:!0,characterData:!0,attributes:!0,attributeFilter:[`style`]}),X(),typeof document<`u`&&document.readyState===`loading`&&document.addEventListener(`DOMContentLoaded`,()=>X()),await p();var We=[...document.querySelectorAll(`[data-auth-area]`)],Z=l(),Q=E(window.location.pathname),Ge=String(window.location.pathname||``).toLowerCase();if(!(Q||Ge.endsWith(`/account.html`))){let e=sessionStorage.getItem(n);if(e){let t=!Z&&/^(Bạn cần đăng nhập|Vui lòng đăng nhập)/i.test(e.trim());sessionStorage.removeItem(n),sessionStorage.removeItem(a),t||window.setTimeout(()=>v(e,5200),120)}}if(Z){let e=c(Z.id).filter(e=>e.campaignId),t=`ecodesk_notified_sales_${Z.id}`,n=new Set(JSON.parse(sessionStorage.getItem(t)||`[]`)),r=e.filter(e=>!n.has(e.code));r.length&&(r.forEach(e=>n.add(e.code)),sessionStorage.setItem(t,JSON.stringify([...n])),window.setTimeout(()=>v(`Bạn có ${r.length} mã sale hôm nay dành riêng cho tài khoản. Xem mã, điều kiện và hạn dùng trong mục Tài khoản.`,6500),350))}function $(e,t,n){let r=document.createElement(`a`);return r.className=e,r.href=t,r.textContent=n,r}function Ke(e){let t=document.querySelector(`[data-drawer-auth]`);if(!t)return;if(!e){let e=document.createElement(`div`);e.className=`drawer-auth-actions`,e.append($(`btn-outline drawer-auth-btn`,`./login.html`,`Đăng nhập`),$(`btn-primary drawer-auth-btn`,`./register.html`,`Đăng ký`)),t.replaceChildren(e);return}let n=document.createElement(`div`);n.className=`drawer-user-box`;let r=document.createElement(`div`);r.className=`drawer-user-greeting`,r.textContent=`Xin chào, ${e.name||e.email||`Khách hàng`}`;let i=document.createElement(`div`);i.className=`drawer-auth-actions`,i.append($(`btn-outline drawer-auth-btn`,`./account.html`,`Tài khoản`)),(e.role===`admin`||e.role===`staff`)&&i.append($(`btn-outline drawer-auth-btn`,`./admin.html`,`Quản lý`));let a=document.createElement(`button`);a.type=`button`,a.className=`btn-outline drawer-auth-btn drawer-logout-btn`,a.textContent=`Đăng xuất`,a.addEventListener(`click`,()=>{document.querySelector(`.actions [data-auth-area] .logout-btn`)?.click()}),i.append(a),n.append(r,i),t.replaceChildren(n)}function qe(e){if(Q){let t=Ge.endsWith(`/login.html`)||Ge===`/login`,n=t?`./register.html`:`./login.html`,r=t?`Đăng ký`:`Đăng nhập`;e.replaceChildren($(`btn-outline auth-link`,m(n),r)),Ke(null)}else e.replaceChildren($(`btn-outline auth-link account-link`,`./account.html`,`Tài khoản`)),Ke(null)}function Je(e,t){let n=document.createElement(`a`);n.className=`btn-outline auth-link account-link`,n.href=`./account.html`,n.textContent=`Tài khoản`;let r=t.role===`admin`||t.role===`staff`,a=null;r&&(a=document.createElement(`a`),a.className=`btn-outline auth-link admin-link`,a.href=`./admin.html`,a.textContent=`Quản lý`);let o=(i()||[]).find(e=>String(e.id)===String(t.id))||t,s=String(o.name||t.name||o.email||t.email||`Khách hàng`).trim(),c=o.avatar||t.avatar,l=typeof c==`string`?c.trim():``,u=`Xin chào, ${s}`,d=document.createElement(`a`);d.className=`user-pill user-greeting-chip`,d.href=`./account.html`,d.title=u,d.setAttribute(`aria-label`,`${u} — Tài khoản`);let f=document.createElement(`span`);f.className=`user-pill-avatar`,f.setAttribute(`aria-hidden`,`true`);let p=()=>{f.classList.remove(`has-photo`);let e=document.createElement(`i`);e.dataset.lucide=`user-round`,e.className=`user-pill-avatar-icon`,f.replaceChildren(e),S(f)};if(l){f.classList.add(`has-photo`);let e=document.createElement(`img`);e.className=`user-pill-avatar-img`,e.src=l,e.alt=``,e.addEventListener(`error`,p,{once:!0}),f.appendChild(e)}else p();let m=document.createElement(`span`);m.className=`user-pill-text`;let h=document.createElement(`span`);h.className=`user-pill-greeting`,h.textContent=`Xin chào`;let g=document.createElement(`span`);g.className=`user-pill-name`,g.textContent=s,m.append(h,g),d.append(f,m);let _=document.createElement(`button`);_.className=`btn-outline auth-link logout-btn`,_.type=`button`,_.textContent=`Đăng xuất`,_.addEventListener(`click`,()=>{w(),v(`Đã đăng xuất.`),window.setTimeout(()=>{let e=window.location.pathname;e.includes(`admin.html`)||e.includes(`add.html`)||e.includes(`edit.html`)||e.includes(`checkout.html`)||e.includes(`account.html`)||e.includes(`customer-orders.html`)?window.location.href=`./index.html`:window.location.reload()},500)});let y=[n];a&&y.push(a),y.push(d,_),e.replaceChildren(...y),Ke(t)}function Ye(){if(Q)return;let e=document.querySelector(`.site-header .actions`);if(e){if(!document.getElementById(`headerWishlistBtn`)){let t=document.createElement(`a`);t.id=`headerWishlistBtn`,t.className=`header-action-btn header-wishlist-btn with-icon`,t.href=`./account.html#wishlist`,t.title=`Sản phẩm yêu thích`,t.setAttribute(`aria-label`,`Sản phẩm yêu thích`),t.innerHTML=`
      <i data-lucide="heart" class="header-wishlist-icon"></i>
      <span id="wishlistCount" class="header-badge" style="display: none;">0</span>
      <span class="control-label">Yêu thích</span>
    `,t.addEventListener(`click`,e=>{l()||(e.preventDefault(),T({next:`./account.html#wishlist`,notice:`Bạn cần đăng nhập để thêm sản phẩm vào yêu thích hoặc xem sản phẩm yêu thích.`}))});let n=e.querySelector(`.cart-pill`);n?e.insertBefore(t,n):e.insertBefore(t,e.firstChild)}if(!document.getElementById(`notifBellBtn`)){let t=document.createElement(`div`);t.className=`header-notif-wrapper`,t.style.cssText=`position: relative; display: inline-flex; align-items: center;`,t.innerHTML=`
      <button type="button" id="notifBellBtn" class="header-action-btn header-notif-btn with-icon" title="Thông báo đơn hàng" aria-label="Thông báo đơn hàng" aria-expanded="false">
        <i data-lucide="bell"></i>
        <span id="notifCountBadge" class="header-badge" style="display: none;">0</span>
      </button>
      <div id="notifDropdown" class="notif-dropdown-popover" style="display: none; background: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.18); border: 1px solid #cbd5e1; z-index: 10000; overflow: hidden;">
      </div>
    `;let n=e.querySelector(`[data-auth-area]`);n?e.insertBefore(t,n):e.appendChild(t)}S(e)}}function Xe(){let e=document.querySelectorAll(`.product-mega a[href*="product="]`);if(!e.length)return;let t=f().filter(e=>e&&e.isHidden!==!0);t.length&&e.forEach(e=>{let n=e.getAttribute(`href`);if(n)try{let r=new URL(n,window.location.origin).searchParams.get(`product`);if(!r)return;let i=u(t,r);i?.name&&(e.textContent=i.name,e.title=i.name)}catch{}})}Ye(),Xe(),se(),Q||(r(),C()),window.addEventListener(`storage`,e=>{(!e.key||e.key.includes(`ecodesk_products`))&&Xe()}),We.forEach(e=>{Z?Je(e,Z):qe(e)}),X(),Q||document.addEventListener(`click`,e=>{e.target.closest(`[data-drawer-utilities] a[href*='account.html#wishlist']`)&&!l()&&(e.preventDefault(),T({next:`./account.html#wishlist`,notice:`Bạn cần đăng nhập để thêm sản phẩm vào yêu thích hoặc xem sản phẩm yêu thích.`}))});export{ae as a,k as c,O as i,X as n,ie as o,ue as r,oe as s,Ve as t};