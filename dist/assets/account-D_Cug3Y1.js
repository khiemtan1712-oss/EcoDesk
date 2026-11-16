import{$t as e,At as t,D as n,J as r,Jt as i,Mt as a,O as o,P as s,S as c,T as l,V as u,W as d,Y as f,Yt as p,Z as m,Zt as h,c as g,dn as _,hn as v,jt as y,kt as b,l as x,mn as S,nn as C,nt as w,pn as T,q as ee,sn as E,un as D,vt as O}from"./chat-ELAsPwSy.js";import{c as k,i as A,o as j}from"./auth-state-DfFp_NEN.js";/* empty css              */import"./assistant-CS_26LUw.js";/* empty css                   *//* empty css                     */import{d as M,f as N,t as P}from"./reviews-BioLUigy.js";/* empty css                        */var F=document.getElementById(`guestLoginLink`),I=document.getElementById(`guestRegisterLink`),L=D(C(`next`))||(window.location.hash===`#wishlist`?`./account.html#wishlist`:`./account.html`);F&&(F.href=p(`./login.html`,{next:L})),I&&(I.href=p(`./register.html`)),await f();var R=sessionStorage.getItem(`ecodesk_auth_notice`);R&&(sessionStorage.removeItem(`ecodesk_auth_notice`),_(R));var z=document.getElementById(`guestView`),B=document.getElementById(`authenticatedPortal`),V=document.getElementById(`guestLoginLink`),H=document.getElementById(`guestRegisterLink`),U=s(),W=U&&(n(U.id)||U);if(U)z&&(z.hidden=!0),B&&(B.hidden=!1),G();else{z&&(z.hidden=!1),B&&(B.hidden=!0);let e=window.location.hash===`#wishlist`?`./account.html#wishlist`:`./account.html`,t=D(C(`next`))||e,n=window.location.hash===`#wishlist`?`Bạn cần đăng nhập để thêm sản phẩm vào yêu thích hoặc xem sản phẩm yêu thích.`:``;V&&(V.href=p(`./login.html`,{next:t}),V.addEventListener(`click`,()=>{T({next:t,notice:n})})),H&&(H.href=p(`./register.html`))}function G(){K(),q(),J(),X(),Z(),Q(),$(),te(),ne(),re(),ie()}function K(){let e=document.getElementById(`userAvatar`),t=document.getElementById(`userDisplayName`),n=document.getElementById(`userDisplayEmail`),i=document.getElementById(`userTierBadge`),a=document.getElementById(`adminAreaBtn`),o=document.getElementById(`btnRemoveAvatar`),s=U.name||`Khách hàng`,c=s.trim().charAt(s.trim().lastIndexOf(` `)+1)||s.charAt(0)||`U`,l=(r().find(e=>String(e.id)===String(U.id))||U).avatar||U.avatar;e&&(l?(e.innerHTML=`<img src="${l}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`,o&&(o.style.display=`inline-block`)):(e.textContent=c.toUpperCase(),o&&(o.style.display=`none`))),t&&(t.textContent=s),n&&(n.textContent=U.email||``);let d=u(U).filter(e=>e.status===`Hoàn thành`).reduce((e,t)=>e+(Number(t.total)||0),0),f=d>0?d:Number(W?.spendTotal||0),p=f>=3e7?`Kim cương`:f>=1e7?`Vàng`:f>=3e6?`Bạc`:W?.tier||`Đồng`;i&&(i.textContent=`Hạng ${p}`,i.className=`account-tier-badge`,p===`Đồng`?i.classList.add(`badge-dong`):p===`Bạc`?i.classList.add(`badge-bac`):p===`Vàng`?i.classList.add(`badge-vang`):p===`Kim cương`&&i.classList.add(`badge-kimcuong`)),a&&(a.hidden=U.role!==`admin`&&U.role!==`staff`)}function q(){let e=document.querySelectorAll(`.account-nav-btn[data-tab]`),t=document.querySelectorAll(`.account-tab-panel`);function n(n){e.forEach(e=>{let t=e.dataset.tab===n;e.classList.toggle(`active`,t),e.setAttribute(`aria-selected`,String(t))}),t.forEach(e=>{let t=e.id===`panel-${n}`;e.classList.toggle(`active`,t)}),S(),window.scrollTo({top:120,behavior:`smooth`})}e.forEach(e=>{e.addEventListener(`click`,()=>n(e.dataset.tab))}),document.querySelectorAll(`[data-jump-tab]`).forEach(e=>{e.addEventListener(`click`,()=>n(e.dataset.jumpTab))});let r=()=>{w(),_(`Đã đăng xuất khỏi tài khoản.`),setTimeout(()=>{window.location.href=`./index.html`},500)},i=document.getElementById(`sidebarLogoutBtn`),a=document.getElementById(`securityLogoutBtn`);i&&i.addEventListener(`click`,r),a&&a.addEventListener(`click`,r),window.location.hash===`#wishlist`&&n(`wishlist`)}async function J(){let t=document.getElementById(`overviewTotalOrders`),n=document.getElementById(`overviewProcessingOrders`),r=document.getElementById(`overviewCompletedOrders`),i=document.getElementById(`overviewActiveCoupons`),a=document.getElementById(`recentOrdersContainer`),s=document.getElementById(`overviewTierBlock`);await l(U.id);let c=u(U),d=o(U.id);if(t&&(t.textContent=c.length),n&&(n.textContent=c.filter(e=>e.status===`Chờ xác nhận`||e.status===`Đang xử lý`||e.status===`Đang giao`).length),r&&(r.textContent=c.filter(e=>e.status===`Hoàn thành`).length),i&&(i.textContent=d.length),a){if(c.length===0)a.innerHTML=`
        <div class="empty-box">
          <p>Bạn chưa có đơn hàng nào tại EcoDesk.</p>
          <a href="./products.html" class="btn" style="margin-top: 10px;">Khám phá sản phẩm ngay</a>
        </div>
      `;else{let t=e=>{let t={"Chờ xác nhận":{class:`badge-pending`,label:`Chờ xác nhận`},"Đang xử lý":{class:`badge-processing`,label:`Đang xử lý`},"Đang giao":{class:`badge-shipping`,label:`Đang giao`},"Hoàn thành":{class:`badge-completed`,label:`Hoàn tất`},"Đã hủy":{class:`badge-cancelled`,label:`Đã hủy`}}[e]||{class:`badge-pending`,label:e||`Chờ xử lý`};return`<span class="order-badge ${t.class}">${t.label}</span>`};a.innerHTML=c.slice(0,3).map(n=>`
        <div class="recent-order-item">
          <div class="recent-order-left">
            <span class="recent-order-id">Đơn hàng #${n.id}</span>
            <span class="recent-order-date">${n.createdAt?new Date(n.createdAt).toLocaleString(`vi-VN`,{dateStyle:`medium`,timeStyle:`short`}):`Vừa xong`}</span>
          </div>
          <div class="recent-order-right">
            <span class="recent-order-total">${e(n.total||0)}</span>
            ${t(n.status)}
            <a href="./customer-orders.html" class="btn-outline" style="padding: 6px 12px; font-size: 12px;">Xem chi tiết</a>
          </div>
        </div>
      `).join(``)}}s&&Y(s)}function Y(t){let r=n(U.id)||W||{},i=u(U).filter(e=>e.status===`Hoàn thành`).reduce((e,t)=>e+(Number(t.total)||0),0),a=i>0?i:Number(r.spendTotal||0),o=a>=3e7?`Kim cương`:a>=1e7?`Vàng`:a>=3e6?`Bạc`:`Đồng`,s={Đồng:3e6,Bạc:1e7,Vàng:3e7,"Kim cương":1/0},c={Đồng:`Bạc`,Bạc:`Vàng`,Vàng:`Kim cương`,"Kim cương":null},l=s[o],d=c[o];if(o===`Kim cương`){t.innerHTML=`
      <div class="tier-progress-card">
        <div class="tier-progress-head">
          <div class="tier-name-large" style="display: flex; align-items: center; gap: 8px;">
            ${v(`award`,{size:20,strokeWidth:1.8})} Hạng Kim cương (Cao nhất)
          </div>
          <div class="tier-spend-num">Đã tích lũy: ${e(a)}</div>
        </div>
        <p style="font-size: 14px; color: var(--co-primary); font-weight: 600; line-height: 1.5; margin-top: 8px; display: flex; align-items: flex-start; gap: 8px;">
          <span style="flex-shrink: 0; margin-top: 2px;">${v(`sparkles`,{size:16,strokeWidth:1.8})}</span>
          <span>Xin chúc mừng! Quý khách đã đạt hạng thành viên cao nhất tại EcoDesk Studio. Quý khách được hưởng chiết khấu ưu đãi 10% trọn đời và đặc quyền chăm sóc ưu tiên 24/7!</span>
        </p>
      </div>
    `;return}let f=Math.max(0,l-a),p=Math.min(100,Math.round(a/l*100));t.innerHTML=`
    <div class="tier-progress-card">
      <div class="tier-progress-head">
        <div class="tier-name-large">Hạng ${o}</div>
        <div class="tier-spend-num">Chi tiêu: <strong>${e(a)}</strong> / ${e(l)}</div>
      </div>
      <div class="tier-progress-bar-wrap" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100">
        <div class="tier-progress-bar-fill" style="width: ${p}%;"></div>
      </div>
      <div class="tier-progress-note">
        Còn <strong>${e(f)}</strong> để nâng hạng thành viên lên <strong>Hạng ${d}</strong> và mở khóa ưu đãi cao hơn.
      </div>
    </div>
  `}function X(){let e=document.getElementById(`profileViewMode`),t=document.getElementById(`profileEditForm`),r=document.getElementById(`btnToggleEditProfile`),i=document.getElementById(`btnCancelEditProfile`),o=document.getElementById(`profileViewName`),c=document.getElementById(`profileViewEmail`).querySelector(`span`),l=document.getElementById(`profileViewPhone`),u=document.getElementById(`profileViewRole`),d=document.getElementById(`editProfileName`),f=document.getElementById(`editProfilePhone`),p=document.getElementById(`editProfileEmail`);function m(){let e=n(U.id)||s();o&&(o.textContent=e.name||`Khách hàng`),c&&(c.textContent=e.email||``),l&&(l.textContent=e.phone||`Chưa cập nhật`),u&&(u.textContent={admin:`Quản trị viên`,staff:`Nhân viên hỗ trợ`,customer:`Khách hàng thân thiết`}[e.role]||`Khách hàng`)}m();function h(){let i=n(U.id)||s();d&&(d.value=i.name||``),f&&(f.value=i.phone||``),p&&(p.value=i.email||``),e.hidden=!0,t.hidden=!1,r.hidden=!0,d.focus()}function g(){e.hidden=!1,t.hidden=!0,r.hidden=!1}r&&r.addEventListener(`click`,h),i&&i.addEventListener(`click`,g),t&&t.addEventListener(`submit`,async e=>{e.preventDefault();let t=d.value.trim(),n=f.value.trim();if(!t||t.length<2){_(`Họ và tên phải có ít nhất 2 ký tự.`),d.focus();return}if(n&&!/^(0|\+84)[0-9]{9,10}$/.test(n.replace(/\s+/g,``))){_(`Số điện thoại không đúng định dạng (Ví dụ: 0901234567).`),f.focus();return}let r=document.getElementById(`btnSaveProfile`);r&&(r.disabled=!0,r.textContent=`Đang lưu...`);try{await a(U.id,{name:t,phone:n}),_(`Đã lưu thông tin cá nhân thành công!`),K(),m(),g()}catch(e){_(e.message||`Lỗi khi lưu thông tin.`)}finally{r&&(r.disabled=!1,r.textContent=`Lưu thay đổi`)}})}function Z(){let e=document.getElementById(`addressListContainer`),t=document.getElementById(`btnOpenAddAddressModal`),r=document.getElementById(`addressModal`),a=document.getElementById(`closeAddressModalBtn`),o=document.getElementById(`btnCancelAddress`),s=document.getElementById(`addressForm`),l=document.getElementById(`addressModalTitle`),u=document.getElementById(`addressEditId`),d=document.getElementById(`addressProvince`);d&&d.options.length<=1&&i.forEach(e=>{let t=document.createElement(`option`);t.value=e,t.textContent=e,d.appendChild(t)});function f(e=!1,t=null){if(r){if(r.classList.add(`open`),r.setAttribute(`aria-hidden`,`false`),document.body.style.overflow=`hidden`,e&&t)l.textContent=`Chỉnh sửa địa chỉ giao hàng`,u.value=t.id,document.getElementById(`addressRecipientName`).value=t.name||``,document.getElementById(`addressPhone`).value=t.phone||``,document.getElementById(`addressProvince`).value=t.province||``,document.getElementById(`addressDetail`).value=t.address||``,document.getElementById(`addressIsDefault`).checked=!!t.isDefault;else{l.textContent=`Thêm địa chỉ giao hàng mới`,s.reset(),u.value=``;let e=n(U.id)||U;document.getElementById(`addressRecipientName`).value=e.name||``,document.getElementById(`addressPhone`).value=e.phone||``}}}function p(){r&&(r.classList.remove(`open`),r.setAttribute(`aria-hidden`,`true`),document.body.style.overflow=``,s.reset())}t&&t.addEventListener(`click`,()=>f(!1)),a&&a.addEventListener(`click`,p),o&&o.addEventListener(`click`,p),r&&r.addEventListener(`click`,e=>{e.target===r&&p()});function m(){if(!e)return;let t=ee(U.id);if(t.length===0){e.innerHTML=`
        <div class="empty-box" style="grid-column: 1 / -1;">
          <p>Bạn chưa lưu địa chỉ nhận hàng nào.</p>
          <button type="button" class="btn" id="btnEmptyAddAddress" style="margin-top: 10px;">Thêm địa chỉ đầu tiên</button>
        </div>
      `;let t=document.getElementById(`btnEmptyAddAddress`);t&&t.addEventListener(`click`,()=>f(!1))}else e.innerHTML=t.map(e=>`
      <div class="address-card ${e.isDefault?`default`:``}" data-addr-id="${e.id}">
        <div>
          ${e.isDefault?`<span class="address-badge-default">Địa chỉ mặc định</span>`:``}
          <div class="address-name">${e.name}</div>
          <div class="address-phone">${e.phone}</div>
          <div class="address-detail">${e.address}, ${e.province}</div>
        </div>
        <div class="address-actions">
          ${e.isDefault?``:`<button type="button" class="address-btn-link" data-action="set-default" data-id="${e.id}">Đặt làm mặc định</button>`}
          <button type="button" class="address-btn-link" data-action="edit" data-id="${e.id}">Chỉnh sửa</button>
          <button type="button" class="address-btn-link danger" data-action="delete" data-id="${e.id}">Xóa</button>
        </div>
      </div>
    `).join(``),e.querySelectorAll(`[data-action='set-default']`).forEach(e=>{e.addEventListener(`click`,()=>{O(U.id,e.dataset.id),_(`Đã đặt địa chỉ mặc định.`),m()})}),e.querySelectorAll(`[data-action='edit']`).forEach(e=>{e.addEventListener(`click`,()=>{let n=t.find(t=>t.id===e.dataset.id);n&&f(!0,n)})}),e.querySelectorAll(`[data-action='delete']`).forEach(e=>{e.addEventListener(`click`,()=>{confirm(`Bạn có chắc chắn muốn xóa địa chỉ giao hàng này không?`)&&(c(U.id,e.dataset.id),_(`Đã xóa địa chỉ thành công.`),m())})})}m(),s&&s.addEventListener(`submit`,e=>{e.preventDefault();let t=u.value,n={name:document.getElementById(`addressRecipientName`).value,phone:document.getElementById(`addressPhone`).value,province:document.getElementById(`addressProvince`).value,address:document.getElementById(`addressDetail`).value,isDefault:document.getElementById(`addressIsDefault`).checked};!n.name.trim()||!n.phone.trim()||!n.province||!n.address.trim()?_(`Vui lòng điền đầy đủ các trường bắt buộc.`):(t?(b(U.id,t,n),_(`Đã cập nhật địa chỉ giao hàng!`)):(x(U.id,n),_(`Đã thêm địa chỉ giao hàng mới!`)),p(),m())})}function Q(){let e=document.getElementById(`rewardsTierFullBlock`),t=document.getElementById(`rewardsCouponsContainer`);if(e&&Y(e),t){let e=o(U.id);if(e.length===0){t.innerHTML=`
        <div class="empty-box" style="grid-column: 1 / -1;">
          <p>Hiện tại bạn chưa có mã ưu đãi nào khả dụng.</p>
        </div>
      `;return}t.innerHTML=e.map(e=>`
      <div class="coupon-ticket-card">
        <div class="coupon-ticket-info">
          <strong>${e.label} · Giảm ${e.percent}%</strong>
          <code>${e.code}</code>
          ${e.condition?`<small style="margin-bottom: 4px;">${e.condition}</small>`:``}
          <small>Hạn dùng: ${new Date(e.expiresAt).toLocaleDateString(`vi-VN`)}</small>
        </div>
        <button type="button" class="btn-copy-code" data-code="${e.code}">Sao chép mã</button>
      </div>
    `).join(``),t.querySelectorAll(`.btn-copy-code`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.code;navigator.clipboard.writeText(t).then(()=>{_(`Đã sao chép mã "${t}" vào bộ nhớ tạm!`)})})})}}function $(){let e=document.getElementById(`securityEmailVal`);e&&(e.textContent=U.email||``)}function te(){let e=document.getElementById(`avatarFileInput`),n=document.getElementById(`userAvatar`),r=document.getElementById(`btnRemoveAvatar`);e?.addEventListener(`change`,async i=>{let a=i.target.files?.[0];if(!a)return;if(a.size>2097152){_(`Dung lượng ảnh vượt quá 2MB. Vui lòng chọn ảnh nhỏ hơn.`),e.value=``;return}if(![`image/jpeg`,`image/png`,`image/webp`].includes(a.type)){_(`Định dạng ảnh không hợp lệ. Chỉ chấp nhận JPG, PNG hoặc WebP.`),e.value=``;return}let o=new FileReader;o.onload=async()=>{let e=o.result;try{await t(U.id,e),U.avatar=e,n&&(n.innerHTML=`<img src="${e}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`),r&&(r.style.display=`inline-block`),_(`Đã cập nhật ảnh đại diện thành công!`)}catch(e){_(e.message||`Không thể cập nhật ảnh đại diện.`)}},o.readAsDataURL(a)}),r?.addEventListener(`click`,async()=>{if(confirm(`Bạn có chắc chắn muốn gỡ ảnh đại diện và khôi phục mặc định?`))try{await t(U.id,null),U.avatar=null;let i=(U.name||`U`).trim().charAt(0).toUpperCase();n&&(n.textContent=i),r&&(r.style.display=`none`),e&&(e.value=``),_(`Đã gỡ ảnh đại diện.`)}catch(e){_(e.message||`Không thể gỡ ảnh đại diện.`)}})}function ne(){let e=document.getElementById(`changePasswordForm`),t=document.getElementById(`changeCurrentPassword`),n=document.getElementById(`changeNewPassword`),r=document.getElementById(`changeConfirmPassword`),i=document.getElementById(`changeStrengthLabel`),a=document.getElementById(`changePasswordError`),o=document.getElementById(`btnSubmitChangePassword`);n?.addEventListener(`input`,e=>{let t=e.target.value;i&&(t?m(t)?(i.textContent=`Mạnh (Đạt yêu cầu)`,i.style.color=`#16a34a`):(i.textContent=`Yếu (Cần >= 8 ký tự, gồm chữ hoa, thường & số)`,i.style.color=`#dc2626`):(i.textContent=`Chưa nhập`,i.style.color=`#64748b`))}),e?.addEventListener(`submit`,async s=>{s.preventDefault(),a&&(a.textContent=``);let c=t?.value,l=n?.value,u=r?.value;if(!c||!l||!u)a&&(a.textContent=`Vui lòng nhập đầy đủ các trường.`);else if(!m(l))a&&(a.textContent=`Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số.`);else if(l!==u)a&&(a.textContent=`Mật khẩu xác nhận không khớp.`);else{o&&(o.disabled=!0,o.textContent=`Đang cập nhật...`);try{let t=await y(U.id,c,l);_(t.message),e.reset(),i&&(i.textContent=`Chưa nhập`,i.style.color=`#64748b`)}catch(e){a&&(a.textContent=e.message)}finally{o&&(o.disabled=!1,o.textContent=`Cập nhật mật khẩu`)}}})}function re(){let t=document.getElementById(`wishlistContainer`),n=document.getElementById(`accountWishlistNavBadge`);if(!t)return;function r(){let i=A(U.id);if(n&&(n.textContent=String(i.length),n.style.display=i.length>0?`inline-block`:`none`),i.length===0){t.innerHTML=`
        <div style="text-align: center; padding: 48px 16px; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
          <div style="margin-bottom: 12px; display: flex; justify-content: center; color: #94a3b8;">${v(`heart`,{size:48,strokeWidth:1.5})}</div>
          <h3 style="font-size: 1.1rem; font-weight: 700; color: #1e293b; margin-bottom: 6px;">Danh sách yêu thích trống</h3>
          <p style="font-size: 14px; color: #64748b; margin-bottom: 20px;">Hãy dạo một vòng cửa hàng và bấm biểu tượng trái tim để lưu lại những sản phẩm ưng ý nhất.</p>
          <a href="./products.html" class="btn">Khám phá sản phẩm ngay</a>
        </div>
      `;return}let a=d(),o=i.map(e=>({id:e,product:a.find(t=>String(t.id)===String(e))}));t.innerHTML=`
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;">
        ${o.map(({id:t,product:n})=>{if(!n)return`
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #fafafa; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <span style="display: inline-block; background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-bottom: 8px;">Ngừng kinh doanh / Đã xóa</span>
                  <div style="font-size: 13px; color: #64748b;">Mã sản phẩm: ${t}</div>
                  <p style="font-size: 13px; color: #475569; margin-top: 6px;">Sản phẩm này hiện không còn trên hệ thống.</p>
                </div>
                <button type="button" class="btn-outline btn-remove-wishlist" data-id="${t}" style="margin-top: 12px; color: #dc2626; border-color: #fca5a5; font-size: 12px;">Xóa khỏi yêu thích</button>
              </div>
            `;let r=Number(n.stock||0)<=0;return`
            <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #fff; display: flex; flex-direction: column; transition: box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'" onmouseout="this.style.boxShadow='none'">
              <a href="./detail.html?id=${n.id}" style="position: relative; display: block; aspect-ratio: 4/3; background: #f8fafc; overflow: hidden;">
                <img src="${n.image||`./images/placeholder.jpg`}" alt="${n.name}" style="width: 100%; height: 100%; object-fit: contain; padding: 8px;">
                ${r?`<span style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.7); color: #fff; font-size: 11px; padding: 3px 8px; border-radius: 4px; font-weight: 700;">Hết hàng</span>`:``}
              </a>
              <div style="padding: 14px; display: flex; flex-direction: column; flex: 1;">
                <a href="./detail.html?id=${n.id}" style="font-weight: 700; font-size: 14px; color: #0f172a; text-decoration: none; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px;">
                  ${n.name}
                </a>
                <div style="font-size: 15px; font-weight: 800; color: #e11d48; margin-bottom: 12px;">
                  ${e(n.price)}
                </div>
                <div style="margin-top: auto; display: flex; gap: 8px;">
                  <button type="button" class="btn btn-add-cart-wishlist" data-id="${n.id}" ${r?`disabled style="opacity:0.5; cursor:not-allowed;"`:``} style="flex: 2; padding: 7px 10px; font-size: 12px;">
                    ${r?`Tạm hết`:`Thêm giỏ`}
                  </button>
                  <button type="button" class="btn-outline btn-remove-wishlist" data-id="${n.id}" title="Bỏ yêu thích" aria-label="Bỏ yêu thích" style="flex: 1; padding: 7px; color: #dc2626; border-color: #fca5a5; font-size: 14px; display: flex; align-items: center; justify-content: center;">
                    ${v(`trash-2`,{size:16})}
                  </button>
                </div>
              </div>
            </div>
          `}).join(``)}
      </div>
    `,t.querySelectorAll(`.btn-remove-wishlist`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=e.dataset.id;await j(t,U.id),r(),k(),_(`Đã xóa sản phẩm khỏi danh sách yêu thích.`)})}),t.querySelectorAll(`.btn-add-cart-wishlist`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.id,n=a.find(e=>String(e.id)===String(t));n&&(g(n,1),_(`Đã thêm "${n.name}" vào giỏ hàng!`))})}),S(t)}r(),window.addEventListener(`ecodesk_favorites_updated`,e=>{String(e.detail.userId)===String(U.id)&&r()}),S()}function ie(){let e=document.getElementById(`accountReviewsContainer`),t=document.getElementById(`accountReviewsNavBadge`);if(!e)return;function n(){let n=N(U),{reviews:r,comments:i}=M(U.id);if(t){let e=n.length>0?n.length:r.length;t.textContent=String(e),t.style.display=e>0?`inline-block`:`none`,t.style.background=n.length>0?`#d97706`:`#1f7a5c`}let a=e=>{if(!e)return``;let t=new Date(e);return isNaN(t.getTime())?String(e):`${t.toLocaleTimeString(`vi-VN`,{hour:`2-digit`,minute:`2-digit`})} · ${t.toLocaleDateString(`vi-VN`)}`},o=n.length>0?`
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
          ${v(`star`,{size:16,strokeWidth:2})} Sản phẩm chờ bạn đánh giá (${n.length})
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px;">
          ${n.map(e=>`
            <div style="border: 1px solid #fde68a; background: #fffbeb; border-radius: 10px; padding: 12px; display: flex; gap: 12px; align-items: center;">
              <img src="${h(e.productImage)}" alt="${h(e.productName)}" style="width: 52px; height: 52px; object-fit: contain; background: #fff; border-radius: 8px; border: 1px solid #f1f5f9; flex-shrink: 0;">
              <div style="min-width: 0; flex: 1;">
                <div style="font-size: 13px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${h(e.productName)}</div>
                <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">Đơn hoàn tất #${h(e.orderId)}</div>
                <a href="./detail.html?id=${encodeURIComponent(e.productId)}#reviewsSection" style="display:inline-flex; align-items:center; gap:4px; margin-top:6px; padding:4px 10px; border-radius:6px; background:#1f7a5c; color:#fff; font-size:11.5px; font-weight:700; text-decoration:none;">Viết đánh giá ngay</a>
              </div>
            </div>
          `).join(``)}
        </div>
      </div>
    `:``,s=`
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 10px;">
          Đánh giá đã gửi (${r.length})
        </h3>
        ${r.length===0?`
          <div style="text-align: center; padding: 28px 16px; background: #f8fafc; border-radius: 10px; border: 1px dashed #cbd5e1;">
            <p style="margin: 0; font-size: 13.5px; color: #64748b;">Bạn chưa gửi đánh giá sao cho sản phẩm nào.</p>
          </div>
        `:`
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${r.map(e=>`
              <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; background: #fff;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                  <div style="display: flex; gap: 10px; align-items: center;">
                    ${e.product?.image?`<img src="${h(e.product.image)}" alt="${h(e.product.name)}" style="width: 44px; height: 44px; object-fit: contain; background: #f8fafc; border-radius: 8px;">`:``}
                    <div>
                      <a href="./detail.html?id=${encodeURIComponent(e.productId)}#reviewsSection" style="font-weight: 700; font-size: 14px; color: #0f172a; text-decoration: none;">${h(e.product?.name||`Sản phẩm ${e.productId}`)}</a>
                      <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px; flex-wrap: wrap;">
                        <span>${E(e.rating)}</span>
                        ${e.verifiedPurchase?`<span style="font-size: 11px; font-weight: 700; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 1px 7px; border-radius: 999px;">Đã mua hàng</span>`:``}
                      </div>
                    </div>
                  </div>
                  <span style="font-size: 12px; color: #94a3b8;">${h(a(e.createdAt||e.date))}</span>
                </div>
                <p style="margin: 10px 0 0; font-size: 13.5px; color: #334155; line-height: 1.5;">${h(e.comment)}</p>
                ${e.adminReply?`
                  <div style="margin-top: 10px; padding: 10px 12px; border-radius: 8px; background: #f1f7f4; border-left: 3px solid #1f7a5c;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; flex-wrap: wrap; gap: 6px;">
                      <strong style="color: #14533e;">EcoDesk phản hồi</strong>
                      <span style="color: #64748b;">${h(e.adminReply.adminName)} · ${h(a(e.adminReply.updatedAt||e.adminReply.createdAt))}</span>
                    </div>
                    <p style="margin: 0; font-size: 13px; color: #1e293b;">${h(e.adminReply.content)}</p>
                  </div>
                `:``}
              </div>
            `).join(``)}
          </div>
        `}
      </div>
    `,c=`
      <div>
        <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 10px;">
          Bình luận thảo luận (${i.length})
        </h3>
        ${i.length===0?`
          <div style="text-align: center; padding: 24px 16px; background: #f8fafc; border-radius: 10px; border: 1px dashed #cbd5e1;">
            <p style="margin: 0; font-size: 13.5px; color: #64748b;">Bạn chưa gửi bình luận nào dưới các đánh giá sản phẩm.</p>
          </div>
        `:`
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${i.map(e=>`
              <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; background: #fff;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <a href="./detail.html?id=${encodeURIComponent(e.productId)}#reviewsSection" style="font-weight: 700; font-size: 13.5px; color: #0f172a; text-decoration: none;">${h(e.product?.name||`Sản phẩm ${e.productId}`)}</a>
                  <span style="font-size: 11.5px; color: #94a3b8;">${h(a(e.createdAt))}</span>
                </div>
                <div style="font-size: 12px; color: #64748b; margin-top: 3px;">Bình luận dưới đánh giá của <strong>${h(e.reviewAuthorName)}</strong></div>
                <p style="margin: 6px 0 0; font-size: 13.5px; color: #334155;">${h(e.content)}</p>
                ${e.adminReply?`
                  <div style="margin-top: 8px; padding: 8px 12px; border-radius: 8px; background: #f1f7f4; border-left: 3px solid #1f7a5c;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
                      <strong style="color: #14533e;">EcoDesk phản hồi</strong>
                      <span style="color: #64748b;">${h(e.adminReply.adminName)} · ${h(a(e.adminReply.updatedAt||e.adminReply.createdAt))}</span>
                    </div>
                    <p style="margin: 0; font-size: 13px; color: #1e293b;">${h(e.adminReply.content)}</p>
                  </div>
                `:``}
              </div>
            `).join(``)}
          </div>
        `}
      </div>
    `;e.innerHTML=o+s+c,S(e)}n(),window.addEventListener(P,n),window.addEventListener(`storage`,e=>{(e.key===`ecodesk_customer_reviews`||e.key===`ecodesk_orders`)&&n()})}