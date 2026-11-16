import{N as e,Qt as t,U as n,Ut as r,W as i,Y as a,Zt as o,an as s,cn as c,en as l,fn as u,hn as d,in as f,it as p,mn as m,tn as h}from"./chat-ELAsPwSy.js";import{r as g,s as _}from"./auth-state-DfFp_NEN.js";/* empty css              */import"./assistant-CS_26LUw.js";/* empty css                   *//* empty css                     */var v=[{key:`all`,label:`Tất cả mức giá`,min:null,max:null},{key:`under500`,label:`Dưới 500.000đ`,min:null,max:499999},{key:`500to2m`,label:`500.000đ – 2.000.000đ`,min:5e5,max:2e6},{key:`2mto5m`,label:`2.000.000đ – 5.000.000đ`,min:2e6,max:5e6},{key:`over5m`,label:`Trên 5.000.000đ`,min:5000001,max:null}],y={under300:{min:null,max:299999,label:`Dưới 300.000đ`},"300to800":{min:3e5,max:8e5,label:`300.000đ – 800.000đ`},over800:{min:800001,max:null,label:`Trên 800.000đ`}},b=[{key:`all`,label:`Tất cả tình trạng`},{key:`in_stock`,label:`Còn hàng`},{key:`low_stock`,label:`Sắp hết hàng`},{key:`out_of_stock`,label:`Tạm hết hàng`}],x=new Set([`relevance`,`newest`,`soldDesc`,`priceAsc`,`priceDesc`,`nameAsc`,`nameDesc`,`oldest`]),S={search:``,category:`all`,product:``,price:`all`,minPrice:``,maxPrice:``,stock:`all`,sort:`newest`,attrs:{}};function C(e){let t=Array.isArray(e?.variants)&&e.variants.length>0,n=0;n=t?e.variants.reduce((e,t)=>e+Math.max(0,Number(t.stock)||0),0):Math.max(0,Number(e?.stock)||0);let r=String(e?.status||``),i=n<=0||r===`Hết hàng`||r===`Tạm hết hàng`||r===`Ngừng kinh doanh`;return{totalStock:n,isOut:i,isLow:!i&&n<=15}}function w(){if(S.minPrice!==``||S.maxPrice!==``)return{min:S.minPrice!==``&&!isNaN(Number(S.minPrice))?Math.max(0,Number(S.minPrice)):null,max:S.maxPrice!==``&&!isNaN(Number(S.maxPrice))?Math.max(0,Number(S.maxPrice)):null};let e=v.find(e=>e.key===S.price);if(e)return{min:e.min,max:e.max};let t=y[S.price];return t?{min:t.min,max:t.max}:{min:null,max:null}}function T(e,t){if(t.min==null&&t.max==null)return!0;let r=Array.isArray(e?.variants)&&e.variants.length>0,i=[];return i=r?e.variants.map(t=>{let r=t.price!=null&&!isNaN(t.price)?Number(t.price):Number(e.price||0);return n({...e,price:r},new Date,t).price}):[n(e).price],i.some(e=>!(t.min!=null&&e<t.min||t.max!=null&&e>t.max))}function E(e,t){let n=f(t);if(!n)return!0;let r=f([e.name,e.id,e.description,p(e.tags).join(` `),...Array.isArray(e.variants)?e.variants.map(e=>`${e.name||``} ${e.sku||``} ${Object.values(e.options||{}).join(` `)}`):[]].join(` `));return n.split(/\s+/).filter(Boolean).every(e=>r.includes(e))}function D(e,t){let n=Object.entries(t||{}).filter(([,e])=>Array.isArray(e)&&e.length>0);if(n.length===0)return!0;let r=Array.isArray(e?.variants)?e.variants:[];return r.length!==0&&r.some(e=>!e.options||typeof e.options!=`object`?!1:n.every(([t,n])=>{let r=String(e.options[t]||``).trim();return n.includes(r)}))}function O(e){let t=new Map;for(let n of e){if(!Array.isArray(n.variants)||n.variants.length===0)continue;let e=new Set;for(let r of n.variants)if(r.options&&typeof r.options==`object`)for(let[i,a]of Object.entries(r.options)){let r=String(i||``).trim(),o=String(a||``).trim();if(!r||!o)continue;t.has(r)||t.set(r,new Map);let s=t.get(r);s.has(o)||s.set(o,new Set),s.get(o).add(n.id),e.add(`${r}::${o}`)}}return Array.from(t.entries()).map(([e,t])=>({name:e,values:Array.from(t.entries()).map(([e,t])=>({value:e,count:t.size})).sort((e,t)=>t.count-e.count||e.value.localeCompare(t.value,`vi`))})).filter(e=>e.values.length>0)}function k(e){let t=new Map(e.map(e=>[e.name,new Set(e.values.map(e=>e.value))])),n=!1;for(let[e,r]of Object.entries(S.attrs)){let i=t.get(e);if(!i){delete S.attrs[e],n=!0;continue}let a=(r||[]).filter(e=>i.has(e));a.length!==(r||[]).length&&(n=!0),a.length>0?S.attrs[e]=a:delete S.attrs[e]}return n}function A(){let e=new URLSearchParams(window.location.search);S.search=e.get(`search`)||``,S.category=e.get(`category`)||`all`,S.product=(e.get(`product`)||``).trim(),S.price=e.get(`price`)||`all`,S.minPrice=e.get(`minPrice`)||``,S.maxPrice=e.get(`maxPrice`)||``,S.stock=b.some(t=>t.key===e.get(`stock`))?e.get(`stock`):`all`;let t=e.get(`sort`);S.sort=t&&x.has(t)?t:S.search.trim()?`relevance`:`newest`,S.sort===`relevance`&&!S.search.trim()&&(S.sort=`newest`),S.attrs={},e.getAll(`attr`).forEach(e=>{let t=e.indexOf(`:`);if(t<=0)return;let n=e.slice(0,t).trim(),r=e.slice(t+1).split(`|`).map(e=>e.trim()).filter(Boolean);n&&r.length>0&&(S.attrs[n]=Array.from(new Set(r)))})}function j(){let e=new URLSearchParams;S.search.trim()&&e.set(`search`,S.search.trim()),S.category&&S.category!==`all`&&e.set(`category`,S.category),S.product&&e.set(`product`,S.product),S.minPrice!==``||S.maxPrice!==``?(S.minPrice!==``&&e.set(`minPrice`,S.minPrice),S.maxPrice!==``&&e.set(`maxPrice`,S.maxPrice)):S.price&&S.price!==`all`&&e.set(`price`,S.price),S.stock&&S.stock!==`all`&&e.set(`stock`,S.stock),S.sort&&S.sort!==`newest`&&(S.sort!==`relevance`||S.search.trim())&&e.set(`sort`,S.sort);for(let[t,n]of Object.entries(S.attrs))Array.isArray(n)&&n.length>0&&e.append(`attr`,`${t}:${n.join(`|`)}`);let t=e.toString(),n=`${window.location.pathname}${t?`?${t}`:``}`;n!==`${window.location.pathname}${window.location.search}`&&window.history.replaceState(null,``,n)}function M(){let e=0;S.search.trim()&&e++,S.category!==`all`&&e++,S.product&&e++,(S.minPrice!==``||S.maxPrice!==``||S.price!==`all`)&&e++,S.stock!==`all`&&e++;for(let t of Object.values(S.attrs))Array.isArray(t)&&(e+=t.length);return e}function N(e,t){let n=r(`#categoryFilterList`);if(!n)return;let i=new Map;t.forEach(e=>{i.set(e.categoryId,(i.get(e.categoryId)||0)+1)}),n.innerHTML=[{id:`all`,name:`Tất cả sản phẩm`,count:t.length},...e.map(e=>({id:e.id,name:e.name,count:i.get(e.id)||0}))].map(e=>`
      <button
        type="button"
        class="catalog-filter-pill ${S.category===e.id?`is-active`:``}"
        data-cat-filter="${o(e.id)}"
        aria-pressed="${S.category===e.id?`true`:`false`}"
      >
        <span>${o(e.name)}</span>
        <span class="catalog-pill-count">${e.count}</span>
      </button>
    `).join(``)}function P(){let e=r(`#pricePresetList`);if(!e)return;let t=S.minPrice!==``||S.maxPrice!==``;e.innerHTML=v.map(e=>{let n=!t&&S.price===e.key;return`
      <button
        type="button"
        class="catalog-filter-pill ${n?`is-active`:``}"
        data-price-preset="${e.key}"
        aria-pressed="${n?`true`:`false`}"
      >
        <span>${e.label}</span>
      </button>
    `}).join(``)}function F(e){let t=r(`#stockFilterList`);if(!t)return;let n={all:e.length,in_stock:0,low_stock:0,out_of_stock:0};e.forEach(e=>{let t=C(e);t.isOut?n.out_of_stock++:(n.in_stock++,t.isLow&&n.low_stock++)}),t.innerHTML=b.map(e=>{let t=S.stock===e.key;return`
      <button
        type="button"
        class="catalog-filter-pill ${t?`is-active`:``}"
        data-stock-filter="${e.key}"
        aria-pressed="${t?`true`:`false`}"
      >
        <span>${e.label}</span>
        <span class="catalog-pill-count">${n[e.key]||0}</span>
      </button>
    `}).join(``)}function I(e){let t=r(`#dynamicAttributeFilters`);t&&(t.innerHTML=e.length?e.map(e=>{let t=S.attrs[e.name]||[];return/màu|color/i.test(e.name)?`
          <div class="catalog-filter-group">
            <h2 class="catalog-filter-heading">${o(e.name)}</h2>
            <div class="catalog-color-grid">
              ${e.values.map(n=>{let r=t.includes(n.value),i=c(n.value);return`
                    <button
                      type="button"
                      class="catalog-swatch-chip ${r?`is-active`:``}"
                      data-attr-name="${o(e.name)}"
                      data-attr-val="${o(n.value)}"
                      aria-pressed="${r?`true`:`false`}"
                      title="${o(n.value)} (${n.count})"
                    >
                      <span class="catalog-swatch-dot" style="background: ${i.hex}; border-color: ${i.border};"></span>
                      <span class="catalog-swatch-label">${o(n.value)}</span>
                      <span class="catalog-pill-count">${n.count}</span>
                    </button>
                  `}).join(``)}
            </div>
          </div>
        `:`
        <div class="catalog-filter-group">
          <h2 class="catalog-filter-heading">${o(e.name)}</h2>
          <div class="catalog-filter-chips">
            ${e.values.map(n=>{let r=t.includes(n.value);return`
                  <button
                    type="button"
                    class="catalog-attr-chip ${r?`is-active`:``}"
                    data-attr-name="${o(e.name)}"
                    data-attr-val="${o(n.value)}"
                    aria-pressed="${r?`true`:`false`}"
                  >
                    <span>${o(n.value)}</span>
                    <span class="catalog-pill-count">${n.count}</span>
                  </button>
                `}).join(``)}
          </div>
        </div>
      `}).join(``):``)}function L(e,t=null){let n=r(`#activeFilterChips`),i=r(`#clearAllFiltersBtn`),a=r(`#activeFilterCountBadge`);if(!n)return;let s=[];if(S.category!==`all`&&s.push({type:`category`,label:`Danh mục: ${h(e,S.category)}`}),S.search.trim()&&s.push({type:`search`,label:`Từ khóa: "${S.search.trim()}"`}),S.product&&s.push({type:`product`,label:t?.name?`Sản phẩm: ${t.name}`:`Sản phẩm: Không tìm thấy`}),S.minPrice!==``||S.maxPrice!==``){let e=S.minPrice===``?`0đ`:l(Number(S.minPrice)),t=S.maxPrice===``?`Trở lên`:l(Number(S.maxPrice));s.push({type:`customPrice`,label:`Giá: ${e} – ${t}`})}else if(S.price!==`all`){let e=v.find(e=>e.key===S.price)?.label||y[S.price]?.label||S.price;s.push({type:`price`,label:`Giá: ${e}`})}if(S.stock!==`all`){let e=b.find(e=>e.key===S.stock)?.label||S.stock;s.push({type:`stock`,label:`Kho: ${e}`})}for(let[e,t]of Object.entries(S.attrs))(t||[]).forEach(t=>{s.push({type:`attr`,attrName:e,attrVal:t,label:`${e}: ${t}`})});let c=M();i&&(i.hidden=c===0),a&&(a.hidden=c===0,a.textContent=String(c)),s.length===0?(n.hidden=!0,n.innerHTML=``):(n.hidden=!1,n.innerHTML=`
    <span class="active-filters-label">Đang lọc:</span>
    ${s.map(e=>`
      <button
        type="button"
        class="active-filter-chip"
        data-remove-type="${o(e.type)}"
        data-remove-attr="${o(e.attrName||``)}"
        data-remove-val="${o(e.attrVal||``)}"
        aria-label="Xóa bộ lọc ${o(e.label)}"
      >
        <span>${o(e.label)}</span>
        <span class="active-filter-chip-x" aria-hidden="true">${d(`x`,{size:13,strokeWidth:2.2})}</span>
      </button>
    `).join(``)}
    <button type="button" class="active-filters-clear" id="clearAllChipsBtn">Xóa tất cả</button>
  `)}function R(e){let t=r(`#catalogTitle`);t&&(t.textContent=S.category===`all`?`Tất cả sản phẩm EcoDesk`:h(e,S.category));let n=r(`#searchInput`);n&&n.value!==S.search&&(n.value=S.search);let i=r(`#minPriceInput`),a=r(`#maxPriceInput`);i&&i.value!==String(S.minPrice||``)&&(i.value=String(S.minPrice||``)),a&&a.value!==String(S.maxPrice||``)&&(a.value=String(S.maxPrice||``));let o=r(`#sortSelect`),s=r(`#sortOptionRelevance`),c=!!S.search.trim();s&&(s.hidden=!c),!c&&S.sort===`relevance`&&(S.sort=`newest`),o&&(o.value=S.sort)}function z({keepSearch:e=!1}={}){e||(S.search=``),S.category=`all`,S.product=``,S.price=`all`,S.minPrice=``,S.maxPrice=``,S.stock=`all`,S.attrs={},!S.search.trim()&&S.sort===`relevance`&&(S.sort=`newest`)}function B(){let n=e(),a=i().filter(e=>e.isHidden!==!0);S.category!==`all`&&!n.some(e=>e.id===S.category)&&(S.category=`all`);let o=a.filter(e=>S.category===`all`||e.categoryId===S.category),c=O(o);k(c)&&j();let l=S.product?t(a,S.product):null;N(n,a),P(),F(o),I(c),R(n),L(n,l);let f=w(),p=a.filter(e=>{if(S.product&&(!l||String(e.id)!==String(l.id))||S.category!==`all`&&e.categoryId!==S.category||!E(e,S.search)||!T(e,f))return!1;if(S.stock!==`all`){let t=C(e);if(S.stock===`in_stock`&&t.isOut||S.stock===`low_stock`&&!t.isLow||S.stock===`out_of_stock`&&!t.isOut)return!1}return!!D(e,S.attrs)}),h=u(p,S.sort,S.search),v=r(`#resultCountText`);v&&(v.textContent=h.length===a.length&&M()===0?`Hiển thị toàn bộ ${h.length} sản phẩm`:`Tìm thấy ${h.length} / ${a.length} sản phẩm`);let y=r(`#productList`);if(y){let e=!(!S.product||l);y.innerHTML=h.length?h.map(e=>s(e,n)).join(``):`
        <div class="empty catalog-empty-state">
          <div class="catalog-empty-icon">${d(`search`,{size:36,strokeWidth:1.75})}</div>
          <h3>${e?`Không tìm thấy sản phẩm đã chọn`:`Không tìm thấy sản phẩm phù hợp`}</h3>
          <p>${e?`Sản phẩm từ liên kết này không tồn tại hoặc hiện không còn kinh doanh. Bạn có thể xóa bộ lọc sản phẩm để xem toàn bộ danh mục EcoDesk.`:`Không có sản phẩm nào khớp với bộ lọc hiện tại. Hãy thử điều chỉnh khoảng giá, bỏ bớt thuộc tính hoặc xem toàn bộ danh mục.`}</p>
          <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;">
            ${S.product?`<button type="button" class="btn-outline catalog-empty-reset-btn" id="emptyClearProductFilterBtn">Bỏ lọc sản phẩm</button>`:``}
            <button type="button" class="btn catalog-empty-reset-btn" id="emptyResetFiltersBtn">Xóa tất cả bộ lọc</button>
          </div>
        </div>
      `,_(y),g(y)}m(document)}function V(){let e=r(`#catalogSidebar`),t=document.querySelector(`.site-header`);if(!e||!t)return;let n=Math.ceil(t.getBoundingClientRect().height);n>0&&e.style.setProperty(`--catalog-sticky-top`,`${n+16}px`)}function H(){let e=r(`#catalogSidebar`),t=r(`#mobileFilterToggleBtn`);V(),window.addEventListener(`resize`,V,{passive:!0}),document.fonts?.ready?.then(V).catch(()=>{}),t&&e&&t.addEventListener(`click`,()=>{let n=e.classList.toggle(`is-open`);t.setAttribute(`aria-expanded`,String(n))});let n=r(`#searchInput`);n&&n.addEventListener(`input`,e=>{let t=!S.search.trim();S.search=e.target.value;let n=!!S.search.trim();t&&n&&S.sort===`newest`?S.sort=`relevance`:!n&&S.sort===`relevance`&&(S.sort=`newest`),j(),B()});let i=r(`#sortSelect`);i&&i.addEventListener(`change`,e=>{S.sort=x.has(e.target.value)?e.target.value:`newest`,j(),B()});let a=r(`#categoryFilterList`);a&&a.addEventListener(`click`,e=>{let t=e.target.closest(`[data-cat-filter]`);t&&(S.category=t.getAttribute(`data-cat-filter`)||`all`,S.product=``,j(),B())});let o=r(`#pricePresetList`);o&&o.addEventListener(`click`,e=>{let t=e.target.closest(`[data-price-preset]`);t&&(S.price=t.getAttribute(`data-price-preset`)||`all`,S.minPrice=``,S.maxPrice=``,j(),B())});let s=()=>{let e=r(`#minPriceInput`)?.value.trim()||``,t=r(`#maxPriceInput`)?.value.trim()||``,n=e===``?null:Math.max(0,Number(e)),i=t===``?null:Math.max(0,Number(t));if(n!=null&&i!=null&&n>i){let e=n;n=i,i=e}S.minPrice=n!=null&&!isNaN(n)?String(n):``,S.maxPrice=i!=null&&!isNaN(i)?String(i):``,S.price=S.minPrice!==``||S.maxPrice!==``?`custom`:`all`,j(),B()};r(`#applyPriceRangeBtn`)?.addEventListener(`click`,s),[`#minPriceInput`,`#maxPriceInput`].forEach(e=>{r(e)?.addEventListener(`keydown`,e=>{e.key===`Enter`&&(e.preventDefault(),s())})});let c=r(`#stockFilterList`);c&&c.addEventListener(`click`,e=>{let t=e.target.closest(`[data-stock-filter]`);t&&(S.stock=t.getAttribute(`data-stock-filter`)||`all`,j(),B())});let l=r(`#dynamicAttributeFilters`);l&&l.addEventListener(`click`,e=>{let t=e.target.closest(`[data-attr-name][data-attr-val]`);if(!t)return;let n=t.getAttribute(`data-attr-name`),r=t.getAttribute(`data-attr-val`);if(!n||!r)return;let i=new Set(S.attrs[n]||[]);i.has(r)?i.delete(r):i.add(r),i.size>0?S.attrs[n]=Array.from(i):delete S.attrs[n],j(),B()}),r(`#clearAllFiltersBtn`)?.addEventListener(`click`,()=>{z(),j(),B()}),document.addEventListener(`click`,e=>{if(e.target.closest(`#emptyClearProductFilterBtn`)){S.product=``,j(),B();return}if(e.target.closest(`#clearAllChipsBtn`)||e.target.closest(`#emptyResetFiltersBtn`)){z(),j(),B();return}let t=e.target.closest(`.active-filter-chip[data-remove-type]`);if(!t)return;let n=t.getAttribute(`data-remove-type`);if(n===`category`)S.category=`all`;else if(n===`search`)S.search=``,S.sort===`relevance`&&(S.sort=`newest`);else if(n===`product`)S.product=``;else if(n===`price`||n===`customPrice`)S.price=`all`,S.minPrice=``,S.maxPrice=``;else if(n===`stock`)S.stock=`all`;else if(n===`attr`){let e=t.getAttribute(`data-remove-attr`),n=t.getAttribute(`data-remove-val`);if(e&&n&&Array.isArray(S.attrs[e])){let t=S.attrs[e].filter(e=>e!==n);t.length>0?S.attrs[e]=t:delete S.attrs[e]}}j(),B()}),window.addEventListener(`popstate`,()=>{A(),B()}),window.addEventListener(`storage`,e=>{(!e.key||e.key.includes(`ecodesk_products`)||e.key.includes(`ecodesk_categories`))&&B()})}async function U(){await a(),A(),H(),B()}U();