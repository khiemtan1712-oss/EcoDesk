import{$t as e,B as t,Ct as n,E as r,P as i,T as a,V as o,Y as s,Yt as c,Zt as l,c as u,dn as d,dt as f,hn as p,mn as m,w as h}from"./chat-DXzIvOEk.js";import"./auth-state-DbVAYLiB.js";/* empty css              */import"./assistant-Bl3dD0Kt.js";/* empty css                   *//* empty css                     */import{u as g}from"./reviews-DXluw-M7.js";import{a as _,n as v,r as y,t as ee}from"./sepay-BzTqLbya.js";/* empty css                        */function b(e){if(!e)return!1;let t=String(e).trim().toLowerCase();return t===`hoàn thành`||t===`hoàn tất`||t===`đã giao`||t===`giao thành công`}await s();var te=await v().catch(()=>null),x=null,S=null,C=i(),w=document.getElementById(`ordersContainer`),ne=document.getElementById(`userGreeting`),T=document.getElementById(`statTotalOrders`),E=document.getElementById(`statPendingOrders`),re=document.getElementById(`statProcessingOrders`),D=document.getElementById(`statCompletedOrders`),O=document.querySelectorAll(`.filter-tab`),k=document.getElementById(`orderDetailModal`),A=document.getElementById(`closeOrderModalBtn`),ie=document.getElementById(`modalOrderCode`),ae=document.getElementById(`modalOrderContent`),j=document.getElementById(`supportModal`),M=document.getElementById(`closeSupportModalBtn`),N=document.getElementById(`closeSupportModalActionBtn`),oe=document.getElementById(`supportOrderCode`),se=document.getElementById(`supportOrderStatusBadge`),P=document.getElementById(`editOrderModal`),F=document.getElementById(`closeEditModalBtn`),I=document.getElementById(`cancelEditBtn`),ce=document.getElementById(`editOrderForm`),le=document.getElementById(`editOrderId`),L=document.getElementById(`editCustomerName`),R=document.getElementById(`editCustomerPhone`),z=document.getElementById(`editShippingAddress`),ue=document.getElementById(`editNote`),B=document.getElementById(`saveEditBtn`),V=document.getElementById(`cancelOrderModal`),de=document.getElementById(`closeCancelModalBtn`),fe=document.getElementById(`abortCancelBtn`),H=document.getElementById(`confirmCancelBtn`),pe=document.getElementById(`cancelOrderSummary`),U=document.getElementById(`cancelOtherReasonGroup`),W=document.getElementById(`cancelCustomReason`),me=document.querySelectorAll(`input[name='cancelReasonRadio']`),G=[],K=`all`,q=null;function J(e){e&&(e.classList.add(`open`),e.setAttribute(`aria-hidden`,`false`),document.body.style.overflow=`hidden`)}function Y(e){e&&(e===k&&X(),e.classList.remove(`open`),e.setAttribute(`aria-hidden`,`true`),document.querySelector(`.order-modal.open`)||(document.body.style.overflow=``))}function X(){x&&=(clearInterval(x),null),S=null}window.addEventListener(`pagehide`,X),A&&A.addEventListener(`click`,()=>Y(k)),k&&k.addEventListener(`click`,e=>{e.target===k&&Y(k)}),F&&F.addEventListener(`click`,()=>Y(P)),I&&I.addEventListener(`click`,()=>Y(P)),P&&P.addEventListener(`click`,e=>{e.target===P&&Y(P)}),de&&de.addEventListener(`click`,()=>Y(V)),fe&&fe.addEventListener(`click`,()=>Y(V)),V&&V.addEventListener(`click`,e=>{e.target===V&&Y(V)}),M&&M.addEventListener(`click`,()=>Y(j)),N&&N.addEventListener(`click`,()=>Y(j)),j&&j.addEventListener(`click`,e=>{e.target===j&&Y(j)});function he(e){j&&e&&(oe&&(oe.textContent=`#${e.id}`),se&&(se.innerHTML=ge(e.status)),J(j))}document.addEventListener(`keydown`,e=>{if(e.key===`Escape`){if(j&&j.classList.contains(`open`)){Y(j);return}if(V&&V.classList.contains(`open`)){Y(V);return}if(P&&P.classList.contains(`open`)){Y(P);return}k&&k.classList.contains(`open`)&&Y(k)}}),me.forEach(e=>{e.addEventListener(`change`,()=>{me.forEach(e=>{e.closest(`.reason-radio-label`)?.classList.toggle(`selected`,e.checked)}),e.value===`Lý do khác`&&e.checked?(U&&(U.style.display=`block`),W&&W.focus()):U&&(U.style.display=`none`)})});function ge(e){let t={"Chờ xác nhận":{class:`badge-pending`,label:`Chờ xác nhận`,icon:`clock`},"Đang xử lý":{class:`badge-processing`,label:`Đang xử lý`,icon:`package`},"Đang giao":{class:`badge-shipping`,label:`Đang giao`,icon:`truck`},"Hoàn thành":{class:`badge-completed`,label:`Hoàn tất`,icon:`check-circle-2`},"Đã hủy":{class:`badge-cancelled`,label:`Đã hủy`,icon:`x-circle`}}[e]||{class:`badge-pending`,label:e||`Chờ xử lý`,icon:`clock`},n=p(t.icon,{size:14,strokeWidth:2,class:`badge-icon`});return`<span class="order-badge ${t.class}">${n} ${t.label}</span>`}function _e(e){if(e.itemsJson)try{let t=JSON.parse(e.itemsJson);if(Array.isArray(t)&&t.length>0)return t}catch{}return Array.isArray(e.items)&&e.items.length>0?e.items:[{name:`Sản phẩm nội thất EcoDesk`,quantity:1,unitPrice:Number(e.total||0),image:`./images/ban-nang-ha-mat-go.png`}]}function ve(e){T&&(T.textContent=e.length),E&&(E.textContent=e.filter(e=>(e.status||``).trim().toLowerCase()===`chờ xác nhận`).length),re&&(re.textContent=e.filter(e=>{let t=(e.status||``).trim().toLowerCase();return t===`đang xử lý`||t===`đang giao`}).length),D&&(D.textContent=e.filter(e=>b(e.status)).length)}function Z(){if(!C){w.innerHTML=`
      <div class="orders-empty">
        <div class="orders-empty-icon" style="display:flex; justify-content:center; margin-bottom:12px; color: #94a3b8;">${p(`lock`,{size:48,strokeWidth:1.5})}</div>
        <h3>Vui lòng đăng nhập để xem đơn hàng</h3>
        <p>Bạn cần đăng nhập bằng tài khoản EcoDesk để tra cứu danh sách và trạng thái các đơn hàng đã đặt.</p>
        <a href="${l(c(`./login.html`,{next:`./customer-orders.html`}))}" class="btn">Đăng nhập tài khoản</a>
      </div>
    `;return}let t=K===`all`?G:G.filter(e=>K===`Hoàn thành`?b(e.status):(e.status||``).toLowerCase()===K.toLowerCase());t.length===0?w.innerHTML=`
      <div class="orders-empty">
        <div class="orders-empty-icon" style="display:flex; justify-content:center; margin-bottom:12px; color: #94a3b8;">${p(`package`,{size:48,strokeWidth:1.5})}</div>
        <h3>${K===`all`?`Bạn chưa có đơn hàng nào`:`Không có đơn hàng nào ở trạng thái "${K}"`}</h3>
        <p>Hãy trải nghiệm các mẫu bàn nâng hạ, ghế công thái học và phụ kiện setup chuẩn công thái học tại EcoDesk.</p>
        <a href="./products.html" class="btn">Khám phá sản phẩm ngay</a>
      </div>
    `:(w.innerHTML=t.map(t=>{let n=_e(t),r=t.createdAt?new Date(t.createdAt).toLocaleString(`vi-VN`,{dateStyle:`medium`,timeStyle:`short`}):`Vừa xong`,i=Number(t.total||0),a=(t.status||``).trim().toLowerCase()===`chờ xác nhận`,o=(t.status||``).trim().toLowerCase()===`đã hủy`,s=b(t.status),c=String(t.cancelRequestStatus||``).trim().toUpperCase(),u=!o&&c===`PENDING`,d=!o&&c===`REJECTED`,f=String(t.refundStatus||``).trim().toUpperCase(),m=y(t),h=m.isQr&&!m.isPaid&&!o&&!u,g=!s&&!o&&!u,_=a&&!u;return`
      <article class="order-card" data-order-id="${t.id}">
        <div class="order-card-header">
          <div class="order-card-id-block">
            <span class="order-card-id">Đơn hàng #${t.id}</span>
            <span class="order-card-date">• ${r}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
            <span class="payment-pill ${m.badgeClass}">${l(m.shortLabel)}</span>
            ${ge(t.status)}
            ${u?`<span class="payment-pill unpaid" style="background:#fff7ed; color:#c2410c; border-color:#fdba74;">Chờ duyệt hủy</span>`:``}
            ${o&&f===`PENDING_REFUND`?`<span class="payment-pill unpaid">Chờ hoàn tiền</span>`:o&&f===`REFUNDED`?`<span class="payment-pill paid">Đã hoàn tiền</span>`:``}
          </div>
        </div>

        ${u?`<div style="margin: 0 18px 10px; padding: 10px 12px; border-radius: 8px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; font-size: 13px;">
                <strong>Chờ duyệt hủy:</strong> Đang chờ nhân viên xử lý yêu cầu hủy (${l(t.cancelRequestReason||`Theo yêu cầu`)}). Trong thời gian này không thể gửi thêm yêu cầu hủy hoặc thanh toán QR.
              </div>`:d?`<div style="margin: 0 18px 10px; padding: 10px 12px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 13px;">
                <strong>Yêu cầu hủy đã bị từ chối:</strong> ${l(t.cancelRejectReason||`Không đủ điều kiện hủy.`)} Đơn hàng tiếp tục ở trạng thái <strong>${l(t.status)}</strong>.
              </div>`:``}

        <div class="order-card-items">
          ${n.map(t=>`
            <div class="order-item-row">
              <img src="${t.image||`./images/ban-nang-ha-mat-go.png`}" alt="${t.name}" class="order-item-img" onerror="this.src='./images/ban-nang-ha-mat-go.png'">
              <div class="order-item-info">
                <div class="order-item-name">${t.name}</div>
                ${t.variantName?`<div class="order-item-variant" style="font-size: 11.5px; color: #15803d; font-weight: 600;">Phân loại: ${t.variantName}</div>`:``}
                <div class="order-item-meta">Số lượng: <strong>x${t.quantity||1}</strong> · Đơn giá: ${e(t.unitPrice||t.price||0)}</div>
              </div>
              <div class="order-item-price">${e((t.unitPrice||t.price||0)*(t.quantity||1))}</div>
            </div>
          `).join(``)}
        </div>

        <div class="order-card-footer">
          <div class="order-card-summary">
            <span>Tổng thanh toán:</span>
            <strong class="order-card-total">${e(i)}</strong>
          </div>
          <div class="order-card-actions">
            ${h?`<button type="button" class="btn-pay-order" data-action="pay" data-order-id="${t.id}" title="Mở lại mã QR thanh toán cho đơn này">
                    ${p(`qr-code`,{size:14,strokeWidth:2})} Thanh toán đơn
                  </button>`:``}
            <button type="button" class="btn-detail" data-action="detail" data-order-id="${t.id}">Xem chi tiết</button>
            ${_?`
              <button type="button" class="btn-edit-order" data-action="edit" data-order-id="${t.id}" title="Thay đổi thông tin nhận hàng" style="display: inline-flex; align-items: center; gap: 4px;">
                ${p(`edit-2`,{size:13,strokeWidth:1.8})} Thay đổi thông tin
              </button>
            `:``}
            ${g?`
              <button type="button" class="btn-cancel-order" data-action="cancel" data-order-id="${t.id}" title="Gửi yêu cầu hủy đơn hàng này">
                Hủy đơn
              </button>
            `:``}
            ${s?`<button type="button" class="btn-reorder" data-action="reorder" data-order-id="${t.id}">Mua lại</button>`:``}
          </div>
        </div>
      </article>
    `}).join(``),w.querySelectorAll(`[data-action='pay']`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=e.dataset.orderId;te||=await v().catch(()=>null);let n=await h(t).catch(()=>null)||G.find(e=>String(e.id)===String(t));n&&Q(n,{focusPayment:!0})})}),w.querySelectorAll(`[data-action='detail']`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.orderId,n=G.find(e=>String(e.id)===String(t));n&&Q(n)})}),w.querySelectorAll(`[data-action='edit']`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.orderId,n=G.find(e=>String(e.id)===String(t));n&&we(n)})}),w.querySelectorAll(`[data-action='cancel']`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.orderId,n=G.find(e=>String(e.id)===String(t));n&&Te(n)})}),w.querySelectorAll(`[data-action='reorder']`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.orderId,n=G.find(e=>String(e.id)===String(t));n&&Ee(n)})}),m())}function ye(e){if(Array.isArray(e.statusHistory)&&e.statusHistory.length>0)return e.statusHistory;if(e.statusHistoryJson)try{let t=JSON.parse(e.statusHistoryJson);if(Array.isArray(t)&&t.length>0)return t}catch{}return[]}function be(e){if(!e)return``;try{let t=new Date(e);return isNaN(t.getTime())?``:t.toLocaleString(`vi-VN`,{hour:`2-digit`,minute:`2-digit`,day:`2-digit`,month:`2-digit`,year:`numeric`})}catch{return``}}function xe(e,t){let n=[...e];return n.length===0&&t.createdAt&&n.push({status:`Chờ xác nhận`,timestamp:t.createdAt,note:`Đơn hàng đã được đặt thành công`,by:t.customerName||`Khách hàng`}),n.length===0?``:`
    <div class="order-history-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 12.5px; font-weight: 700; color: var(--co-ink); display: inline-flex; align-items: center; gap: 6px;">
          ${p(`history`,{size:15,strokeWidth:2})} Lịch sử cập nhật đơn hàng (${n.length} mốc ghi nhận)
        </span>
      </div>
      <div class="history-timeline-list">
        ${n.map(e=>`
            <div class="history-timeline-item ${(e.status||``).trim().toLowerCase()===`đã hủy`?`cancelled`:``}">
              <span class="history-item-time">${be(e.timestamp)||`Đang xử lý`}</span>
              <div class="history-item-text">
                <strong>${l(e.status||``)}</strong>: ${l(e.note||`Cập nhật trạng thái`)}
                ${e.by?`<span class="history-item-by"> · ${l(e.by)}</span>`:``}
              </div>
            </div>
          `).join(``)}
      </div>
    </div>
  `}function Se(e){let t=ye(e),n=(e.status||`Chờ xác nhận`).trim(),r=n.toLowerCase(),i=r===`đã hủy`,a=b(n),o=r===`đang giao`,s=r===`đang xử lý`,c=r===`chờ xác nhận`,u=n=>{if(n===`Chờ xác nhận`){let n=t.find(e=>(e.status||``).trim().toLowerCase()===`chờ xác nhận`)?.timestamp||e.createdAt;return n?be(n):``}let r=t.find(e=>(e.status||``).trim().toLowerCase()===n.toLowerCase());return r?.timestamp?be(r.timestamp):``};if(i){let n=t.some(e=>(e.status||``).trim().toLowerCase()===`đang xử lý`),r=t.some(e=>(e.status||``).trim().toLowerCase()===`đang giao`),i=u(`Chờ xác nhận`),a=u(`Đang xử lý`),o=u(`Đang giao`),s=e.cancelledAt?be(e.cancelledAt):u(`Đã hủy`);return`
      <div class="order-tracker-card">
        <div class="tracker-header">
          <div class="tracker-title">
            <span style="display:inline-flex; align-items:center; gap:6px;">${p(`package`,{size:16,strokeWidth:2})} Tiến trình đơn hàng #${e.id}</span>
          </div>
          <span class="tracker-status-chip cancelled" style="display:inline-flex; align-items:center; gap:5px;">${p(`x-circle`,{size:13,strokeWidth:2})} Tiến trình đã dừng (Đã hủy)</span>
        </div>

        <div class="order-stepper">
          <!-- Bước 1: Đặt đơn -->
          <div class="stepper-step is-completed">
            <div class="stepper-line"></div>
            <div class="step-node">${p(`check`,{size:14,strokeWidth:2.5})}</div>
            <div class="step-body">
              <span class="step-name">1. Chờ xác nhận</span>
              ${i?`<span class="step-time">${i}</span>`:``}
              <span class="step-desc">Đơn hàng đã đặt</span>
            </div>
          </div>

          <!-- Bước 2: Đã xác nhận (nếu có trước khi hủy) -->
          ${n?`
            <div class="stepper-step is-completed">
              <div class="stepper-line"></div>
              <div class="step-node">${p(`check`,{size:14,strokeWidth:2.5})}</div>
              <div class="step-body">
                <span class="step-name">2. Đã xác nhận</span>
                ${a?`<span class="step-time">${a}</span>`:``}
                <span class="step-desc">Đóng gói hàng</span>
              </div>
            </div>
          `:``}

          <!-- Bước 3: Đang giao (nếu có trước khi hủy) -->
          ${r?`
            <div class="stepper-step is-completed">
              <div class="stepper-line"></div>
              <div class="step-node">${p(`check`,{size:14,strokeWidth:2.5})}</div>
              <div class="step-body">
                <span class="step-name">3. Đang giao hàng</span>
                ${o?`<span class="step-time">${o}</span>`:``}
                <span class="step-desc">Vận chuyển</span>
              </div>
            </div>
          `:``}

          <!-- Bước Hủy Đơn -->
          <div class="stepper-step is-cancelled">
            <div class="stepper-line"></div>
            <div class="step-node">${p(`x`,{size:14,strokeWidth:2.5})}</div>
            <div class="step-body">
              <span class="step-name">Đã hủy đơn</span>
              ${s?`<span class="step-time">${s}</span>`:``}
              <span class="step-desc">${l(e.cancelledBy?`Bởi: ${e.cancelledBy}`:`Đã dừng xử lý`)}</span>
            </div>
          </div>

          <!-- Bước Hoàn tất dừng lại -->
          <div class="stepper-step is-pending">
            <div class="stepper-line"></div>
            <div class="step-node">—</div>
            <div class="step-body">
              <span class="step-name">Hoàn tất</span>
              <span class="step-desc">Không thực hiện</span>
            </div>
          </div>
        </div>

        ${xe(t,e)}
      </div>
    `}let d=`is-completed`,f=`is-pending`,m=`is-pending`,h=`is-pending`,g=`pending`,_=`Chờ xác nhận`;c?(d=`is-active`,f=`is-pending`,m=`is-pending`,h=`is-pending`,g=`pending`,_=`<span style="display:inline-flex; align-items:center; gap:5px;">${p(`clock`,{size:13,strokeWidth:2})} Chờ xác nhận</span>`):s?(d=`is-completed`,f=`is-active`,m=`is-pending`,h=`is-pending`,g=`processing`,_=`<span style="display:inline-flex; align-items:center; gap:5px;">${p(`package`,{size:13,strokeWidth:2})} Đang xử lý & chuẩn bị hàng</span>`):o?(d=`is-completed`,f=`is-completed`,m=`is-active`,h=`is-pending`,g=`shipping`,_=`<span style="display:inline-flex; align-items:center; gap:5px;">${p(`truck`,{size:13,strokeWidth:2})} Đang giao hàng</span>`):a&&(d=`is-completed`,f=`is-completed`,m=`is-completed`,h=`is-completed`,g=`completed`,_=`<span style="display:inline-flex; align-items:center; gap:5px;">${p(`check-circle-2`,{size:13,strokeWidth:2})} Giao hàng thành công</span>`);let v=u(`Chờ xác nhận`),y=u(`Đang xử lý`),ee=u(`Đang giao`),te=u(`Hoàn thành`),x=p(`check`,{size:14,strokeWidth:2.5});return`
    <div class="order-tracker-card">
      <div class="tracker-header">
        <div class="tracker-title">
          <span style="display:inline-flex; align-items:center; gap:6px;">${p(`package`,{size:16,strokeWidth:2})} Tiến trình đơn hàng #${e.id}</span>
        </div>
        <span class="tracker-status-chip ${g}">${_}</span>
      </div>

      <div class="order-stepper">
        <!-- Bước 1: Chờ xác nhận -->
        <div class="stepper-step ${d}">
          <div class="stepper-line"></div>
          <div class="step-node">${d===`is-completed`?x:`1`}</div>
          <div class="step-body">
            <span class="step-name">1. Chờ xác nhận</span>
            ${v?`<span class="step-time">${v}</span>`:d===`is-active`?`<span class="step-time">Đang tiếp nhận</span>`:``}
            <span class="step-desc">Đơn hàng đã đặt</span>
          </div>
        </div>

        <!-- Bước 2: Đã xác nhận & Đang chuẩn bị hàng (Đang xử lý) -->
        <div class="stepper-step ${f}">
          <div class="stepper-line"></div>
          <div class="step-node">${f===`is-completed`?x:`2`}</div>
          <div class="step-body">
            <span class="step-name">2. Đã xác nhận</span>
            ${y?`<span class="step-time">${y}</span>`:f===`is-active`?`<span class="step-time">Đang chuẩn bị</span>`:``}
            <span class="step-desc">Đóng gói hàng</span>
          </div>
        </div>

        <!-- Bước 3: Đang giao hàng (Đang giao) -->
        <div class="stepper-step ${m}">
          <div class="stepper-line"></div>
          <div class="step-node">${m===`is-completed`?x:`3`}</div>
          <div class="step-body">
            <span class="step-name">3. Đang giao hàng</span>
            ${ee?`<span class="step-time">${ee}</span>`:m===`is-active`?`<span class="step-time">Đang vận chuyển</span>`:``}
            <span class="step-desc">Đã giao bưu tá</span>
          </div>
        </div>

        <!-- Bước 4: Hoàn tất (Giao hàng thành công) -->
        <div class="stepper-step ${h}">
          <div class="stepper-line"></div>
          <div class="step-node">${h===`is-completed`?x:`4`}</div>
          <div class="step-body">
            <span class="step-name">4. Hoàn tất</span>
            ${te?`<span class="step-time">${te}</span>`:``}
            <span class="step-desc">Giao thành công</span>
          </div>
        </div>
      </div>

      ${xe(t,e)}
    </div>
  `}function Q(t,n={}){ie.textContent=`Chi tiết đơn hàng #${t.id}`;let r=_e(t),i=Number(t.subtotal||t.total||0),a=Number(t.discount||0),s=Number(t.shippingFee||0),c=Number(t.total||0),u=t.createdAt?new Date(t.createdAt).toLocaleString(`vi-VN`):`Chưa có`,f=(t.status||``).trim().toLowerCase()===`chờ xác nhận`,v=(t.status||``).trim().toLowerCase()===`đã hủy`,x=b(t.status),S=String(t.cancelRequestStatus||``).trim().toUpperCase(),w=!v&&S===`PENDING`,ne=!v&&S===`REJECTED`,T=String(t.refundStatus||``).trim().toUpperCase(),E=y(t),re=!v&&!w&&E.isQr&&!E.isPaid,D=t.paymentReference||``,O=te||{},A=ee({accountNumber:O.accountNumber,bankCode:O.bankCode,amount:c,paymentReference:D});ae.innerHTML=`
    <!-- Tiến trình theo dõi đơn hàng từng bước (Order Stepper & Tracking) -->
    ${Se(t)}

    <!-- Banner Trạng Thái / Hủy Đơn / Hỗ Trợ -->
    ${v?`
      <div class="cancellation-banner">
        <div class="cancellation-banner-header" style="display: flex; align-items: center; gap: 6px;">
          <span>${p(`x-circle`,{size:16,strokeWidth:1.8})} Đơn hàng đã được hủy</span>
        </div>
        <div class="cancellation-banner-detail">
          <div><strong>Lý do hủy:</strong> ${l(t.cancelReason||`Theo yêu cầu của khách hàng`)}</div>
          <div><strong>Người thực hiện:</strong> ${l(t.cancelledBy||`Khách hàng`)}</div>
          ${t.cancelledAt?`<div><strong>Thời gian hủy:</strong> ${new Date(t.cancelledAt).toLocaleString(`vi-VN`,{dateStyle:`medium`,timeStyle:`short`})}</div>`:``}
          ${T===`PENDING_REFUND`?`<div><strong>Trạng thái hoàn tiền:</strong> <span style="color:#b45309; font-weight:700;">Chờ hoàn tiền theo quy trình</span></div>`:T===`REFUNDED`?`<div><strong>Trạng thái hoàn tiền:</strong> <span style="color:#15803d; font-weight:700;">Đã hoàn tiền</span></div>`:``}
        </div>
      </div>
    `:w?`
      <div class="modal-notice-box info" style="margin-bottom: 14px; background: #fff7ed; border-color: #fdba74; color: #9a3412;">
        <span class="notice-icon">${p(`clock`,{size:18,strokeWidth:2})}</span>
        <div>
          <strong>Chờ duyệt hủy:</strong> Đang chờ nhân viên xử lý yêu cầu hủy đơn.<br>
          <span>Lý do: <strong>${l(t.cancelRequestReason||`Theo yêu cầu`)}</strong></span>
          ${t.cancelRequestedAt?` · <span>Gửi lúc: ${new Date(t.cancelRequestedAt).toLocaleString(`vi-VN`)}</span>`:``}
        </div>
      </div>
    `:ne?`
      <div class="modal-notice-box danger" style="margin-bottom: 14px;">
        <span class="notice-icon">${p(`alert-circle`,{size:18,strokeWidth:2})}</span>
        <div>
          <strong>Yêu cầu hủy đơn đã bị từ chối:</strong> ${l(t.cancelRejectReason||`Không đủ điều kiện hủy.`)}<br>
          <span>Đơn hàng tiếp tục ở trạng thái <strong>${l(t.status)}</strong>. Bạn có thể gửi lại yêu cầu mới nếu cần.</span>
        </div>
      </div>
    `:``}

    ${f?`
      <div style="background: #f0fdf4; border: 1px solid var(--co-primary-border); border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <span style="font-size: 13px; color: var(--co-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
          ${p(`clock`,{size:14,strokeWidth:2})} Đơn hàng đang chờ cửa hàng xác nhận. Quý khách có thể thay đổi thông tin nhận hàng hoặc hủy đơn.
        </span>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn-edit-order" id="modalDetailEditBtn" style="display:inline-flex; align-items:center; gap:4px;">${p(`edit-2`,{size:13,strokeWidth:2})} Đổi thông tin</button>
          <button type="button" class="btn-cancel-order" id="modalDetailCancelBtn">Hủy đơn</button>
        </div>
      </div>
    `:``}

    ${x?`
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <span style="font-size: 13px; color: #15803d; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
          ${p(`check-circle-2`,{size:14,strokeWidth:2})} Đơn hàng đã được giao thành công và hoàn tất. Quý khách có thể đặt mua lại các sản phẩm trong đơn này.
        </span>
        <button type="button" class="btn-reorder" id="modalDetailReorderBtn" data-order-id="${t.id}" style="display:inline-flex; align-items:center; gap:4px;">
          ${p(`rotate-ccw`,{size:13,strokeWidth:2})} Mua lại
        </button>
      </div>
    `:``}

    ${!f&&!v&&!x?`
      <div class="locked-order-banner">
        <span style="display:inline-flex; align-items:center; color:#0284c7;">${p(`info`,{size:20,strokeWidth:2})}</span>
        <div>
          Đơn hàng đang ở trạng thái <strong>${l(t.status)}</strong> nên không thể chỉnh sửa hoặc hủy online.
          Nếu cần thay đổi gấp về địa chỉ hoặc giao hàng, vui lòng bấm <strong>Liên hệ hỗ trợ</strong> hoặc gọi <strong>Hotline 1900 1234</strong> (8:00 - 21:00).
        </div>
      </div>
    `:``}

    <!-- Thông tin trạng thái & thời gian -->
    <div class="modal-section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <span style="font-size: 13px; color: var(--co-muted);">Ngày tạo đơn: <strong>${u}</strong></span>
        ${ge(t.status)}
      </div>
      ${t.updatedAt?`<div style="font-size: 12px; color: var(--co-muted); margin-top: 4px; display:inline-flex; align-items:center; gap:4px;">${p(`clock`,{size:13,strokeWidth:2})} Cập nhật thông tin nhận hàng lần cuối: <strong>${new Date(t.updatedAt).toLocaleString(`vi-VN`)}</strong></div>`:``}
    </div>

    <!-- Thông tin người nhận & giao hàng -->
    <div class="modal-section">
      <h3 class="modal-section-title" style="display:flex; align-items:center; gap:6px;">${p(`map-pin`,{size:16,strokeWidth:2})} Thông tin nhận hàng</h3>
      <div class="modal-grid">
        <div class="modal-grid-item">
          <label>Người nhận:</label>
          <div>${l(t.customerName||C.name||`Khách hàng EcoDesk`)}</div>
        </div>
        <div class="modal-grid-item">
          <label>Số điện thoại:</label>
          <div>${l(t.customerPhone||`Chưa có dữ liệu`)}</div>
        </div>
        <div class="modal-grid-item" style="grid-column: 1 / -1;">
          <label>Địa chỉ nhận hàng:</label>
          <div>${l(t.shippingAddress||`Giao hàng tận nơi`)}</div>
        </div>
        <div class="modal-grid-item">
          <label>Phương thức vận chuyển:</label>
          <div>${l(t.shippingMethod||`Giao hàng tiêu chuẩn (Toàn quốc)`)}</div>
        </div>
        <div class="modal-grid-item">
          <label>Ghi chú đơn hàng:</label>
          <div>${l(t.note||`Không có`)}</div>
        </div>
      </div>
    </div>

    <!-- Phương thức thanh toán -->
    <div class="modal-section">
      <h3 class="modal-section-title" style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
        <span style="display:inline-flex; align-items:center; gap:6px;">${p(`credit-card`,{size:16,strokeWidth:2})} Phương thức &amp; Trạng thái thanh toán</span>
        <span class="payment-pill ${E.badgeClass}" id="modalPaymentStatusPill">${l(E.label)}</span>
      </h3>
      <div style="font-size: 14px; font-weight: 600; color: var(--co-ink);">
        ${l(t.paymentMethod||`Chuyển khoản QR (VietQR / Napas 247)`)}
      </div>
      ${E.isQr&&D?`<div style="margin-top:6px; font-size:13px; color:var(--co-ink-light);">Mã tham chiếu chuyển khoản: <strong style="color:var(--co-primary);">${l(D)}</strong></div>`:``}

      ${E.isQr&&E.isPaid?`
        <div style="margin-top:12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px 14px; font-size:13px; color:#15803d;">
          <strong>Đã xác nhận thanh toán thành công qua SePay</strong>
          ${t.paidAt?`<div style="margin-top:4px; color:#166534;">Thời gian ghi nhận: <strong>${l(t.paidAt)}</strong></div>`:``}
          ${t.paidAmount?`<div style="margin-top:2px; color:#166534;">Số tiền đã nhận: <strong>${e(t.paidAmount)}</strong></div>`:``}
        </div>
      `:``}

      ${E.code===`NEEDS_REVIEW`?`
        <div style="margin-top:12px; background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:12px 14px; font-size:13px; color:#991b1b;">
          <strong>Giao dịch cần đối soát:</strong> ${l(t.paymentReviewReason||`Số tiền hoặc thông tin chuyển khoản chưa khớp hoàn toàn. Vui lòng liên hệ hỗ trợ EcoDesk.`)}
        </div>
      `:``}

      ${re?`
        <div class="modal-payment-card" id="modalSepayQrCard">
          <h4>Thông tin chuyển khoản qua mã QR (SePay)</h4>
          <p style="font-size: 13px; color: var(--co-ink-light); margin-bottom: 8px;">
            Trạng thái hiện tại: <strong>${l(E.label)}</strong>. Quý khách vui lòng chuyển đúng số tiền và đúng mã tham chiếu bên dưới để hệ thống tự động xác nhận:
          </p>
          ${A?`
            <div class="modal-qr-box">
              <img src="${A}"
                   alt="Mã VietQR Thanh toán SePay"
                   class="modal-qr-img"
                   onerror="this.style.display='none'">
              <div class="modal-qr-info">
                <div>Ngân hàng: <strong>${l(O.bankName||O.bankCode||`Chưa cấu hình`)}</strong></div>
                <div>Số tài khoản: <strong style="color: var(--co-primary); font-size: 15px;">${l(O.accountNumber||`—`)}</strong></div>
                <div>Chủ tài khoản: <strong>${l(O.accountName||`—`)}</strong></div>
                <div>Số tiền: <strong>${e(c)}</strong></div>
                <div>Nội dung CK: <strong style="color: #b45309; background: #fef3c7; padding: 2px 6px; border-radius: 4px;">${l(D)}</strong></div>
              </div>
            </div>
          `:`
            <div style="padding:10px 12px; background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; font-size:13px; color:#9a3412;">
              Chưa có đủ cấu hình tài khoản ngân hàng hoặc mã tham chiếu DH từ backend để hiển thị mã QR.
            </div>
          `}
          <div style="margin-top:12px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
            <span id="customerSepaySyncMsg" style="font-size:12.5px; color:var(--co-muted);">Hệ thống tự động đối chiếu giao dịch SePay khi nhận chuyển khoản.</span>
            <button type="button" class="btn-detail" id="customerCheckPaymentBtn" style="font-size:12.5px; padding:6px 12px;">Kiểm tra thanh toán</button>
          </div>
        </div>
      `:``}
    </div>

    <!-- Danh sách sản phẩm -->
    <div class="modal-section">
      <h3 class="modal-section-title" style="display:flex; align-items:center; gap:6px;">${p(`shopping-bag`,{size:16,strokeWidth:2})} Danh sách sản phẩm</h3>
      <div class="order-card-items" style="padding: 0; border: none;">
        ${r.map(n=>{let r=n.productId||n.id,i=``;if(x&&r){let e=g(r,C);(e.unreviewedOrders||[]).some(e=>String(e.id)===String(t.id))?i=`<a href="./detail.html?id=${encodeURIComponent(r)}#reviewsSection" style="display:inline-flex; align-items:center; gap:4px; margin-top:4px; padding:4px 10px; border-radius:6px; background:#fef3c7; color:#92400e; font-size:11.5px; font-weight:700; text-decoration:none; border:1px solid #fde68a;">${p(`star`,{size:12,strokeWidth:2})} Đánh giá sản phẩm</a>`:(e.existingReviews||[]).length>0&&(i=`<a href="./detail.html?id=${encodeURIComponent(r)}#reviewsSection" style="display:inline-flex; align-items:center; gap:4px; margin-top:4px; padding:3px 9px; border-radius:6px; background:#ecfdf5; color:#047857; font-size:11.5px; font-weight:700; text-decoration:none; border:1px solid #a7f3d0;">${p(`check-circle-2`,{size:12,strokeWidth:2})} Đã đánh giá</a>`)}return`
          <div class="order-item-row" style="padding: 10px 0; border-bottom: 1px solid var(--co-line);">
            <img src="${n.image||`./images/ban-nang-ha-mat-go.png`}" alt="${l(n.name||``)}" class="order-item-img" style="width: 50px; height: 50px;">
            <div class="order-item-info">
              <div class="order-item-name" style="font-size: 13px;">${l(n.name||``)}</div>
              ${n.variantName?`<div class="order-item-variant" style="font-size: 11.5px; color: #15803d; font-weight: 600;">Phân loại: ${l(n.variantName)}</div>`:``}
              <div class="order-item-meta" style="font-size: 12px;">Số lượng: x${n.quantity||1} · ${e(n.unitPrice||n.price||0)}</div>
              ${i}
            </div>
            <div class="order-item-price" style="font-size: 13px;">${e((n.unitPrice||n.price||0)*(n.quantity||1))}</div>
          </div>
        `}).join(``)}
      </div>

      <!-- Bảng tính tiền -->
      <div class="modal-bill-table">
        <div class="modal-bill-row">
          <span>Tạm tính</span>
          <span>${e(i)}</span>
        </div>
        ${a>0?`
          <div class="modal-bill-row" style="color: var(--co-primary);">
            <span>Giảm giá khuyến mãi (${l(t.couponCode||`VOUCHER`)})</span>
            <span>-${e(a)}</span>
          </div>
        `:``}
        <div class="modal-bill-row">
          <span>Phí vận chuyển</span>
          <span>${s===0?`Miễn phí`:e(s)}</span>
        </div>
        <div class="modal-bill-row total">
          <span>Tổng tiền thanh toán</span>
          <span>${e(c)}</span>
        </div>
      </div>
    </div>

    <!-- Thanh thao tác và Liên hệ hỗ trợ -->
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--co-line); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
      <button type="button" class="btn-support-contact" id="modalSupportContactBtn" style="display:inline-flex; align-items:center; gap:6px;">
        ${p(`phone-call`,{size:14,strokeWidth:2})} Liên hệ hỗ trợ đơn hàng
      </button>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        ${f?`
          <button type="button" class="btn-edit-order" id="modalBottomEditBtn" style="display:inline-flex; align-items:center; gap:4px;">${p(`edit-2`,{size:13,strokeWidth:2})} Đổi thông tin</button>
          <button type="button" class="btn-cancel-order" id="modalBottomCancelBtn">Hủy đơn</button>
        `:``}
        ${x?`
          <button type="button" class="btn-reorder" id="modalBottomReorderBtn" data-order-id="${t.id}" style="display:inline-flex; align-items:center; gap:4px;">
            ${p(`rotate-ccw`,{size:13,strokeWidth:2})} Mua lại đơn hàng
          </button>
        `:``}
      </div>
    </div>
  `;let j=document.getElementById(`modalSupportContactBtn`);j&&(j.onclick=()=>{he(t)});let M=document.getElementById(`modalDetailEditBtn`);M&&(M.onclick=()=>{Y(k),we(t)});let N=document.getElementById(`modalBottomEditBtn`);N&&(N.onclick=()=>{Y(k),we(t)});let oe=document.getElementById(`modalDetailCancelBtn`);oe&&(oe.onclick=()=>{Y(k),Te(t)});let se=document.getElementById(`modalBottomCancelBtn`);se&&(se.onclick=()=>{Y(k),Te(t)});let P=document.getElementById(`modalDetailReorderBtn`);P&&(P.onclick=()=>{Y(k),Ee(t)});let F=document.getElementById(`modalBottomReorderBtn`);F&&(F.onclick=()=>{Y(k),Ee(t)});let I=document.getElementById(`customerCheckPaymentBtn`);if(I&&(I.onclick=async()=>{I.disabled=!0,I.textContent=`Đang kiểm tra...`;let e=document.getElementById(`customerSepaySyncMsg`);try{let n=await _(),r=await h(t.id);if(r){if(G=o(C),ve(G),Z(),y(r).isPaid){d(`Đã xác nhận thanh toán thành công qua SePay!`),Q(r);return}if(y(r).code!==E.code){Q(r);return}}e&&n?.message&&(e.textContent=n.message),d(n?.status===`RATE_LIMITED`?`Vui lòng thử lại sau ${n.retryAfterSeconds||30} giây.`:`Chưa ghi nhận giao dịch khớp đơn hàng này.`)}finally{I.disabled=!1,I.textContent=`Kiểm tra thanh toán`}}),m(k),J(k),n.focusPayment){let e=document.getElementById(`modalSepayQrCard`);e&&window.setTimeout(()=>e.scrollIntoView({behavior:`smooth`,block:`center`}),60)}re?Ce(t.id):X()}function Ce(e){X(),S=e;let t=0;x=setInterval(async()=>{if(!k||!k.classList.contains(`open`)||String(S)!==String(e)){X();return}t+=1,t%3==1&&await _();let n=await h(e);if(!n)return;G=o(C),ve(G),Z();let r=y(n),i=(n.status||``).trim().toLowerCase()===`đã hủy`;(r.isPaid||i)&&(X(),r.isPaid&&d(`Đã xác nhận thanh toán chuyển khoản qua SePay!`),Q(n))},5e3)}function we(e){let n=t().find(t=>String(t.id)===String(e.id))||e;n.status===`Chờ xác nhận`?(le&&(le.value=e.id),L&&(L.value=e.customerName||C.name||``),R&&(R.value=e.customerPhone||C.phone||``),z&&(z.value=e.shippingAddress||C.address||``),ue&&(ue.value=e.note||``),J(P)):d(`Đơn hàng #${e.id} hiện ở trạng thái "${n.status}", không thể chỉnh sửa thông tin online.`,`error`)}ce&&ce.addEventListener(`submit`,async e=>{e.preventDefault();let r=le.value,i=L.value.trim(),a=R.value.trim(),o=z.value.trim(),s=ue.value.trim();if(!i){alert(`Vui lòng nhập họ và tên người nhận hàng.`),L.focus();return}if(!/^(0|\+84)[3|5|7|8|9][0-9]{8}$/.test(a.replace(/\s+/g,``))){alert(`Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại di động 10 chữ số (VD: 0901234567).`),R.focus();return}if(o.length<5){alert(`Vui lòng nhập địa chỉ nhận hàng chi tiết và đầy đủ.`),z.focus();return}let c=t().find(e=>String(e.id)===String(r));if(!c||c.status!==`Chờ xác nhận`)alert(`Đơn hàng #${r} đã được xử lý sang trạng thái "${c?c.status:`không khả dụng`}", không thể chỉnh sửa trực tuyến. Vui lòng liên hệ Hotline 1900 1234.`),Y(P),await $();else{B.disabled=!0,B.textContent=`Đang lưu...`;try{await n(r,{customerName:i,customerPhone:a,shippingAddress:o,note:s}),Y(P),await $(),d(`Đã cập nhật thông tin nhận hàng đơn #${r} thành công!`)}catch(e){console.error(`Lỗi cập nhật đơn:`,e),d(`Có lỗi xảy ra khi lưu thông tin. Vui lòng thử lại.`,`error`)}finally{B.disabled=!1,B.textContent=`Lưu thay đổi`}}});function Te(n){let r=t().find(e=>String(e.id)===String(n.id))||n,i=String(r.status||``).trim(),a=String(r.cancelRequestStatus||``).trim().toUpperCase();if(b(i)||i.toLowerCase()===`đã hủy`){d(`Đơn hàng #${n.id} hiện ở trạng thái "${i}", không thể gửi yêu cầu hủy.`,`error`);return}if(a===`PENDING`){d(`Đơn hàng #${n.id} đang có yêu cầu hủy chờ nhân viên duyệt.`,`info`);return}q=r;let o=_e(r),s=Number(r.total||0),c=r.createdAt?new Date(r.createdAt).toLocaleString(`vi-VN`,{dateStyle:`medium`,timeStyle:`short`}):`Vừa xong`;pe&&(pe.innerHTML=`
      <div class="cancel-summary-row">
        <span>Mã đơn hàng:</span>
        <strong>#${r.id}</strong>
      </div>
      <div class="cancel-summary-row">
        <span>Thời gian đặt:</span>
        <span>${c}</span>
      </div>
      <div class="cancel-summary-row">
        <span>Tổng số tiền:</span>
        <strong style="color: var(--co-primary); font-size: 15px;">${e(s)}</strong>
      </div>
      <div class="cancel-summary-items">
        <strong>Sản phẩm trong đơn (${o.length}):</strong>
        ${o.map(e=>`<div>• ${e.name} (x${e.quantity||1})${e.variantName?` - [${e.variantName}]`:``}</div>`).join(``)}
      </div>
    `),me.forEach((e,t)=>{e.checked=t===0,e.closest(`.reason-radio-label`)?.classList.toggle(`selected`,t===0)}),U&&(U.style.display=`none`),W&&(W.value=``),J(V)}H&&H.addEventListener(`click`,async()=>{if(!q)return;let e=q.id,n=t().find(t=>String(t.id)===String(e)),r=n?String(n.status||``).trim():``,i=n?String(n.cancelRequestStatus||``).trim().toUpperCase():``;if(!n||b(r)||r.toLowerCase()===`đã hủy`||i===`PENDING`){d(i===`PENDING`?`Đơn hàng này đang có yêu cầu hủy chờ duyệt.`:`Đơn hàng #${e} hiện ở trạng thái "${n?n.status:`không khả dụng`}" nên không thể gửi yêu cầu hủy.`,`error`),Y(V),await $();return}let a=document.querySelector(`input[name='cancelReasonRadio']:checked`),o=a?a.value:`Không có lý do`;if(o===`Lý do khác`){let e=W?W.value.trim():``;if(!e){alert(`Vui lòng ghi rõ lý do bạn muốn hủy đơn hàng.`),W&&W.focus();return}o=`Lý do khác: ${e}`}H.disabled=!0,H.textContent=`Đang gửi...`;try{await f(e,o),Y(V),await $(),d(`Đã gửi yêu cầu hủy đơn #${e}. Đang chờ nhân viên xử lý.`)}catch(e){console.error(`Lỗi khi gửi yêu cầu hủy đơn:`,e),d(e?.message||`Không thể gửi yêu cầu hủy đơn. Vui lòng thử lại.`,`error`)}finally{H.disabled=!1,H.textContent=`Gửi yêu cầu hủy`,q=null}});function Ee(e){if(!b(e.status)){d(`Đơn hàng #${e.id} đang ở trạng thái "${e.status}". Chức năng Mua lại chỉ áp dụng cho đơn hàng đã hoàn tất thành công.`,`warning`);return}let t=_e(e);if(!t||t.length===0){d(`Đơn hàng không có sản phẩm nào để mua lại.`,`warning`);return}let n=0,i=[],a=[];for(let e of t){let t=e.productId||e.id;if(!t){i.push(e.name||`Sản phẩm không rõ mã`);continue}let o=r(t);if(!o)i.push(`"${e.name}" (Sản phẩm không còn kinh doanh)`);else if(o.status===`Ngừng kinh doanh`)i.push(`"${e.name}" (Đã ngừng kinh doanh)`);else if(e.variantId&&Array.isArray(o.variants)&&o.variants.length>0){let t=o.variants.find(t=>String(t.id)===String(e.variantId)||String(t.sku)===String(e.variantId));if(!t){i.push(`"${e.name}${e.variantName?` - ${e.variantName}`:``}" (Phiên bản này không còn mở bán)`);continue}let r=Math.max(0,Number(t.stock)||0);if(r<=0||t.status===`Tạm hết hàng`||t.status===`Hết hàng`){i.push(`"${e.name} (${t.name||e.variantName})": Tạm hết hàng`);continue}let s=Math.max(1,Number(e.quantity)||1),c=Math.min(s,r);try{u(o.id,c,t.id,t.options||null,t.name||e.variantName,t.price==null?e.unitPrice||e.price:Number(t.price),t.image||e.image||o.image),n++,c<s&&a.push(`"${e.name} (${t.name})": chỉ thêm ${c}/${s} chiếc do tồn kho có hạn`)}catch(n){i.push(`"${e.name} (${t.name})": ${n.message}`)}}else if(Array.isArray(o.variants)&&o.variants.length>0){let t=o.variants.find(e=>(Number(e.stock)||0)>0);if(!t){i.push(`"${e.name}": Tạm hết hàng`);continue}let r=Math.max(1,Number(e.quantity)||1),s=Math.max(0,Number(t.stock)||0),c=Math.min(r,s);try{u(o.id,c,t.id,t.options||null,t.name,t.price==null?o.price:Number(t.price),t.image||o.image),n++,c<r&&a.push(`"${e.name}": chỉ thêm ${c}/${r} chiếc do tồn kho có hạn`)}catch(t){i.push(`"${e.name}": ${t.message}`)}}else{let t=Math.max(0,Number(o.stock)||0);if(t<=0||o.status===`Hết hàng`||o.status===`Tạm hết hàng`){i.push(`"${e.name}": Tạm hết hàng`);continue}let r=Math.max(1,Number(e.quantity)||1),s=Math.min(r,t);try{u(o.id,s,null,null,null,e.unitPrice||e.price||o.price,o.image||e.image),n++,s<r&&a.push(`"${e.name}": chỉ thêm ${s}/${r} chiếc do tồn kho có hạn`)}catch(t){i.push(`"${e.name}": ${t.message}`)}}}if(n>0){if(i.length===0&&a.length===0)d(`Đã thêm lại toàn bộ ${n} sản phẩm từ đơn #${e.id} vào giỏ hàng!`),setTimeout(()=>{window.location.href=`./cart.html`},600);else{let e=[];i.length>0&&e.push(`Không thể mua lại: ${i.join(`, `)}`),a.length>0&&e.push(a.join(`; `)),d(`Đã thêm ${n} sản phẩm vào giỏ hàng. ${e.join(`. `)}`,`warning`),setTimeout(()=>{window.location.href=`./cart.html`},1500)}}else{let t=i.length>0?i.join(`, `):`Các sản phẩm trong đơn hiện đã hết hàng hoặc ngừng kinh doanh`;d(`Không thể mua lại đơn #${e.id}: ${t}.`,`error`)}}O.forEach(e=>{e.addEventListener(`click`,()=>{O.forEach(e=>e.classList.remove(`active`)),e.classList.add(`active`),K=e.dataset.status,Z()})});async function $(){C&&(await a(C.id),G=o(C),ve(G)),Z()}async function De(){C?(ne&&(ne.textContent=`Xin chào ${C.name}, đây là lịch sử các đơn hàng của bạn tại EcoDesk.`),await $()):Z()}De();