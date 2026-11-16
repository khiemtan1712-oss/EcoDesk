import{Cn as e,M as t,N as n,Sn as r,U as i,Ut as a,W as o,Y as s,en as c,k as l,sn as u,tn as d}from"./chat-DXzIvOEk.js";import{r as f}from"./auth-state-DbVAYLiB.js";/* empty css              */import"./assistant-Bl3dD0Kt.js";/* empty css                   *//* empty css                     */var p=(e=``)=>String(e).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e]);function m(e){let t=a(`#categoryList`);t&&(t.innerHTML=e.map(e=>`<a class="category-btn" href="products.html?category=${e.id}">${e.name}</a>`).join(``))}function h(t,n){let r=a(`#featuredProducts`);r&&(r.innerHTML=[...t].filter(e=>!e.isDraft&&e.status!==`Bản nháp`&&e.status!==`Ngừng kinh doanh`).sort((e,t)=>t.sold-e.sold).slice(0,15).map(t=>{let r=i(t),a=Number(t.rating||0),o=Number(t.reviewCount||0),s=Array.isArray(t.variants)&&t.variants.length>0,l=0,f=0,p=0;s?t.variants.forEach(e=>{let t=Math.max(0,Number(e.stock)||0);l+=t,t>0?f++:p++}):l=Math.max(0,Number(t.stock)||0);let m=l<=0||t.status===`Hết hàng`||t.status===`Tạm hết hàng`||t.status===`Ngừng kinh doanh`,h=s&&f>0&&p>0,g=!m&&l<=15,_=``;_=m?`<span class="product-stock-pill out-of-stock"><span class="stock-dot"></span>Tạm hết hàng</span>`:h?`<span class="product-stock-pill in-stock"><span class="stock-dot"></span>Còn hàng</span> <span class="product-partial-soldout-hint">Một số mẫu đã hết hàng</span>`:g?`<span class="product-stock-pill low-stock"><span class="stock-dot"></span>Sắp hết (${l})</span>`:`<span class="product-stock-pill in-stock"><span class="stock-dot"></span>Còn hàng</span>`;let v=`${r.percent?`<del>${c(r.original)}</del> `:``}${c(r.price)}`;if(s){let e=t.variants.map(e=>Number(e.price)).filter(e=>!isNaN(e)&&e>0);if(e.length>0){let t=Math.min(...e);t<Math.max(...e)&&(v=`Từ <strong>${c(t)}</strong>`)}}return`
    <article class="featured-card ${m?`is-out-of-stock`:``}">
      <a class="featured-image" href="detail.html?id=${t.id}">
        <div class="card-corner-badges">
          ${r.percent?`<span class="badge-sale-pill">${r.badgeText||`-${r.percent}%`}</span>`:``}
          ${e(t)?`<span class="badge-new-pill">Mới</span>`:`<span class="badge-top-pill">Bán chạy</span>`}
        </div>
        ${m?`<div class="card-out-overlay">Tạm hết hàng</div>`:``}
        <img src="${t.image}" alt="${t.name}" loading="lazy">
      </a>
      <div class="featured-info">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span class="featured-category">${d(n,t.categoryId)}</span>
          ${_}
        </div>
        <h3><a href="detail.html?id=${t.id}">${t.name}</a></h3>
        <div class="featured-rating" aria-label="${o>0?`Đánh giá ${a.toFixed(1)} trên 5 (${o} đánh giá), ${t.sold} lượt bán`:`Chưa có đánh giá, ${t.sold} lượt bán`}">
          ${o>0?`${u(a)}<span class="rating-score">${a.toFixed(1)}</span><span class="rating-count">(${o}) • ${t.sold} đã bán</span>`:`<span class="rating-count">Chưa có đánh giá • ${t.sold} đã bán</span>`}
        </div>
        <div class="featured-foot">
          <span class="featured-price">${v}</span>
          <a class="btn-outline" href="detail.html?id=${t.id}">Xem chi tiết</a>
        </div>
      </div>
    </article>
  `}).join(``))}function g(t,n){let r=a(`#newProducts`);if(!r)return;let o=t.filter(t=>!t.isDraft&&t.status!==`Bản nháp`&&t.status!==`Ngừng kinh doanh`&&e(t)).sort((e,t)=>new Date(t.createdAt)-new Date(e.createdAt)).slice(0,6);r.innerHTML=o.map(e=>{let t=i(e);return`<article class="new-product-card"><a href="detail.html?id=${e.id}" class="new-product-image"><span class="badge badge-new">Mới</span>${t.percent?`<span class="new-sale-badge">${t.badgeText||`-${t.percent}%`}</span>`:``}<img src="${e.image}" alt="${e.name}" loading="lazy"></a><div class="new-product-info"><span class="featured-category">${d(n,e.categoryId)}</span><h3><a href="detail.html?id=${e.id}">${e.name}</a></h3><p class="new-product-price">${t.percent?`<del>${c(t.original)}</del>`:``}<strong>${c(t.price)}</strong></p></div></article>`}).join(``),a(`#newProductsSection`)?.classList.toggle(`hidden`,o.length===0)}function _(){let e=a(`#scheduledBanner`);if(!e)return;let t=l().filter(e=>r(e)).sort((e,t)=>Number(t.priority||0)-Number(e.priority||0))[0];if(!t){e.classList.add(`hidden`);return}let n=/^(\.\/|\/|#)/.test(t.link||``)?t.link:`./products.html`;e.classList.remove(`hidden`);let i=new URL(t.image||``,window.location.href).href.replace(/["\\\n\r]/g,``);e.style.setProperty(`--banner-image`,`url("${i}")`),e.innerHTML=`<div class="container scheduled-banner-content"><p class="eyebrow">${p(t.kicker||`Ưu đãi EcoDesk`)}</p><h2>${p(t.title)}</h2><p>${p(t.description||`Khám phá sản phẩm phù hợp với không gian của bạn.`)}</p><a class="btn" href="${p(n)}">${p(t.button||`Khám phá ngay`)}</a></div>`}async function v(){await s();let e=n(),r=o();a(`#cartCount`).textContent=t(),m(e),_(),g(r,e),h(r,e),requestAnimationFrame(()=>f())}v();