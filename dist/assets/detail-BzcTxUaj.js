import{Cn as e,E as t,M as n,N as r,P as i,U as a,Ut as o,W as s,Y as c,Yt as l,Zt as u,c as d,cn as f,dn as p,en as m,hn as h,it as g,mn as _,nn as ee,rt as v,sn as y,tn as te}from"./chat-ELAsPwSy.js";import{r as ne}from"./auth-state-DfFp_NEN.js";/* empty css              */import"./assistant-CS_26LUw.js";/* empty css                   *//* empty css                     */import{c as re,g as ie,h as b,l as ae,m as x,t as S,u as C}from"./reviews-BioLUigy.js";function w(e){if(!e)return``;let t=new Date(e);return isNaN(t.getTime())?String(e):String(e).length<=10?t.toLocaleDateString(`vi-VN`):`${t.toLocaleTimeString(`vi-VN`,{hour:`2-digit`,minute:`2-digit`})} · ${t.toLocaleDateString(`vi-VN`)}`}function T(e=``){let t=String(e||`K`).trim().split(/\s+/).filter(Boolean);return(t[t.length-1]||`K`).charAt(0).toUpperCase()}function oe(e,t=[]){let n=Array.isArray(e?.gallery)?e.gallery:[];if(n.length===0&&e?.galleryJson)try{let t=typeof e.galleryJson==`string`?JSON.parse(e.galleryJson):e.galleryJson;Array.isArray(t)&&t.length>0&&(n=t)}catch{}let r=t&&t.length>0?t:Array.isArray(e?.variants)?e.variants:[],i=e=>{if(!e)return null;let t=e.replace(/^\.\//,``).toLowerCase();return r.find(e=>{let n=(e.image||``).replace(/^\.\//,``).toLowerCase();return n===t||t.endsWith(n)||n.endsWith(t)})},a=e=>{let t=(e||``).toLowerCase();return/4color|overview|tong-quan|banner/i.test(t)?{tag:`Tổng quan`,caption:`Tổng quan các màu sắc`,isGeneral:!0}:/health|suc-khoe|ergonomic|so-sanh/i.test(t)?{tag:`Sức khỏe`,caption:`Nâng tầm sức khỏe & tư thế chuẩn`,isGeneral:!0}:/4_4|3_3|1_2|22_8|23_9|tinh-nang|cong-nghe/i.test(t)?/4_4/i.test(t)?{tag:`Thoải mái`,caption:`Nâng tầm sự thoải mái - Đệm êm`,isGeneral:!0}:/3_3/i.test(t)?{tag:`Lưng lưới`,caption:`Lưng lưới thoáng khí cao cấp`,isGeneral:!0}:/1_2/i.test(t)?{tag:`Công thái học`,caption:`Ghế công thái học đỉnh cao`,isGeneral:!0}:/22_8/i.test(t)?{tag:`Tay gập 90°`,caption:`Tựa tay điều chỉnh linh hoạt`,isGeneral:!0}:{tag:`Tính năng`,caption:`Chi tiết tính năng kỹ thuật`,isGeneral:!0}:/26_12|27_13|setup|lifestyle|goc-lam-viec/i.test(t)?{tag:`Setup`,caption:`Gợi ý không gian làm việc`,isGeneral:!0}:null};if(n.length===0){let t=[];return e?.image&&t.push({id:`gal-main`,url:e.image,caption:e.name||`Ảnh sản phẩm`,tag:`Tổng quan`,isGeneral:!0,attributeKey:``,attributeValue:``,variantId:``}),r.forEach((e,n)=>{if(e?.image&&!t.some(t=>t.url===e.image)){let r=``,i=``;if(e.options&&typeof e.options==`object`){for(let[t,n]of Object.entries(e.options))if(/màu|color/i.test(t)){r=t,i=String(n);break}if(!r){let t=Object.entries(e.options)[0];t&&(r=t[0],i=String(t[1]))}}let a=i.split(`(`)[0].trim()||`Lựa chọn ${n+1}`;t.push({id:`gal-var-${n+1}`,url:e.image,caption:e.name||`Lựa chọn ${n+1}`,tag:a,isGeneral:!1,attributeKey:r,attributeValue:i,variantId:e.id||``})}}),t.length>0?t:[{id:`gal-fallback`,url:`./images/ban-nang-ha-mat-go.png`,caption:`EcoDesk Studio`,tag:`EcoDesk`,isGeneral:!0,attributeKey:``,attributeValue:``,variantId:``}]}let o=[],s=new Set,c=(e,t=null,n=0)=>{let r=String(e||``).trim();if(!r)return;let c=v(r);if(!c||s.has(c))return;s.add(c);let l=i(r),u=a(r),d=``,f=``,p=``,m=`Chung`,h=!0,g=`Ảnh ${n+1}`;if(l){if(h=!1,p=l.id||``,l.options&&typeof l.options==`object`){for(let[e,t]of Object.entries(l.options))if(/màu|color/i.test(e)){d=e,f=String(t);break}if(!d){let e=Object.entries(l.options)[0];e&&(d=e[0],f=String(e[1]))}}m=f.split(`(`)[0].trim()||l.name||`Biến thể`,g=l.name||`Phiên bản ${m}`}else u?(m=u.tag,g=u.caption,h=u.isGeneral):t&&typeof t==`object`&&(m=t.tag||(t.attributeValue?t.attributeValue.split(`(`)[0].trim():`Chung`),g=t.caption||`Ảnh ${n+1}`,h=t.isGeneral??(!t.attributeValue&&!t.variantId),d=t.attributeKey||``,f=t.attributeValue||``,p=t.variantId||``);o.push({id:t&&typeof t==`object`&&t?.id||`gal-${o.length+1}`,url:r,caption:g,tag:m,isGeneral:h,attributeKey:d,attributeValue:f,variantId:p})};return e?.image&&c(e.image,{caption:e.name||`Tổng quan sản phẩm`,tag:`Tổng quan`,isGeneral:!0},0),n.forEach((e,t)=>{let n=typeof e==`string`?e:e?.url||``;c(n,e,t)}),r.forEach((e,t)=>{e?.image&&c(e.image,null,o.length+t)}),o}function se(e,t=`Chưa phân loại`){let n=String(e?.name||``).toLowerCase(),r=String(e?.description||``).toLowerCase(),i=String(e?.categoryId||``),a=n.includes(`nâng hạ`)||n.includes(`nang ha`)||n.includes(`smartdesk`)||r.includes(`động cơ`)||r.includes(`nâng hạ điện`),o=!a&&(n.includes(`bàn `)||n.includes(`ban `)||n.includes(`desk`)),s=n.includes(`ghế`)||n.includes(`ghe`)||n.includes(`chair`),c=i===`lighting`||n.includes(`đèn`)||n.includes(`den`),l=[{label:`Sản phẩm`,value:e.name},{label:`Danh mục`,value:t}];return(Array.isArray(e?.attributes)?e.attributes:[]).forEach(e=>{e?.name&&Array.isArray(e.values)&&e.values.length>0&&l.push({label:e.name,value:e.values.join(` / `)})}),a?l.push({label:`Cơ chế vận hành`,value:`Bàn nâng hạ chiều cao thông minh điều khiển điện tử`},{label:`Chiều cao làm việc`,value:`Tùy chỉnh linh hoạt tư thế ngồi & đứng chuẩn công thái học`},{label:`Tính năng an toàn`,value:`Cảm biến chống va chạm tự động, vận hành êm ái`},{label:`Bảo hành`,value:`Bảo hành điện tử chính hãng EcoDesk`}):o?l.push({label:`Thiết kế kết cấu`,value:`Khung thép sơn tĩnh điện chống gỉ, mặt bàn chống trầy xước & chống ẩm`},{label:`Tiện ích đi kèm`,value:`Tối ưu cho setup làm việc, học tập và đi dây gọn gàng`},{label:`Bảo hành`,value:`Bảo hành điện tử chính hãng EcoDesk`}):s?l.push({label:`Công thái học`,value:`Hỗ trợ nâng đỡ cột sống & thắt lưng, tối ưu cho thời gian ngồi dài`},{label:`Piston & Chân đế`,value:`Piston thủy lực chịu tải ổn định, bánh xe di chuyển êm nhẹ`},{label:`Bảo hành`,value:`Bảo hành điện tử chính hãng EcoDesk`}):c?l.push({label:`Nguồn sáng`,value:`Chip LED bảo vệ thị lực, hạn chế nhấp nháy & ánh sáng xanh`},{label:`Nhiệt độ màu`,value:`Điều chỉnh đa chế độ ánh sáng phục vụ đọc sách & làm việc`},{label:`Nguồn cấp`,value:`Kết nối USB Type-C / Adapter tiện lợi`},{label:`Bảo hành`,value:`Bảo hành điện tử chính hãng EcoDesk`}):l.push({label:`Phân phối chính hãng`,value:`EcoDesk Studio Việt Nam`},{label:`Bảo hành`,value:`Bảo hành điện tử chính hãng theo số điện thoại đặt hàng`}),l}function ce(e){let t=String(e?.name||``).toLowerCase(),n=t.includes(`ban`)||t.includes(`desk`),r=t.includes(`ghe`)||t.includes(`chair`);return n?[{q:`Bàn nâng hạ EcoDesk có khó lắp đặt tại nhà không?`,a:`Không hề khó. Sản phẩm đi kèm bản hướng dẫn chi tiết từng bước bằng tiếng Việt và đầy đủ phụ kiện lục giác, ốc vít được đánh số rõ ràng. Thời gian lắp đặt trung bình từ 20 – 30 phút. Tại TP. Hồ Chí Minh, EcoDesk hỗ trợ lắp đặt tận nơi theo yêu cầu.`},{q:`Động cơ của bàn có gây tiếng ồn khi tăng giảm độ cao không?`,a:`Bàn sử dụng động cơ điện thế hệ mới vận hành êm ái với độ ồn dưới 45dB (tương đương tiếng thì thầm trong thư viện), hoàn toàn không làm gián đoạn sự tập trung khi làm việc vào ban đêm.`},{q:`Chế độ bảo hành bàn nâng hạ được áp dụng như thế nào?`,a:`Toàn bộ khung bàn, motor điện và hộp điều khiển được bảo hành chính hãng thông qua hệ thống bảo hành điện tử theo số điện thoại đặt hàng. Khi cần bảo hành, quý khách chỉ cần liên hệ hotline 1900 1234.`}]:r?[{q:`Ghế công thái học phù hợp cho người có chiều cao và cân nặng thế nào?`,a:`Ghế được thiết kế tối ưu nhân trắc học cho vóc dáng người Việt (chiều cao từ 1m50 đến 1m85, cân nặng dưới 130kg). Bạn có thể dễ dàng tùy chỉnh độ cao mặt đệm, vị trí tựa đầu và đệm đỡ thắt lưng theo cơ thể.`},{q:`Lưới ghế có bị xẹp hay nhão sau thời gian dài sử dụng không?`,a:`Ghế sử dụng chất liệu lưới dệt kỹ thuật cao cấp có độ đàn hồi cao, chịu lực bền bỉ và thoáng khí, đảm bảo giữ vững phom dáng và nâng đỡ cột sống êm ái suốt nhiều năm sử dụng.`},{q:`Bánh xe của ghế có làm trầy xước sàn gỗ không?`,a:`Bánh xe được bọc lớp PU mềm cao cấp chống trầy xước, di chuyển êm mượt và không gây tiếng ồn trên mọi bề mặt sàn gỗ, sàn gạch men hoặc thảm trải bàn.`}]:[{q:`Sản phẩm có chính sách bảo hành chính hãng không?`,a:`Mọi sản phẩm tại EcoDesk đều được áp dụng chính sách bảo hành chính hãng điện tử và kiểm định chất lượng kỹ càng trước khi xuất xưởng.`},{q:`Thời gian giao hàng tiêu chuẩn là bao lâu?`,a:`Đơn hàng nội thành TP. Hồ Chí Minh thường được giao trong 24h làm việc. Các tỉnh thành khác trên toàn quốc thời gian giao hàng từ 2 – 4 ngày làm việc.`},{q:`Tôi có thể kiểm tra hàng trước khi thanh toán không?`,a:`Quý khách hoàn toàn được quyền đồng kiểm tra ngoại quan kiện hàng, sản phẩm và phụ kiện đi kèm trước khi nhận hàng.`}]}function le(e){let t=String(e?.name||``).toLowerCase(),n=String(e?.categoryId||``),r=t.includes(`ban`)||t.includes(`desk`),i=t.includes(`ghe`)||t.includes(`chair`),a=n===`lighting`||t.includes(`den`);return r?[{name:`Mặt bàn cốt gỗ MDF lõi xanh chống ẩm chuẩn E1`,qty:`1 kiện`,note:`Bề mặt phủ Melamine cao cấp chống trầy xước`},{name:`Khung chân thép nâng hạ sơn tĩnh điện`,qty:`1 bộ`,note:`Thép carbon chịu tải trọng thực tế 100kg`},{name:`Cụm động cơ điện tĩnh âm & Hộp điều khiển`,qty:`1 bộ`,note:`Vận hành êm dịu < 45dB, nhớ 4 vị trí thông minh`},{name:`Khay kẹp dẫn dây gầm bàn & nắp luồn cáp`,qty:`1 bộ`,note:`Tối ưu hóa giấu dây cho không gian gọn gàng`},{name:`Bộ ốc vít, khóa lục giác & Sách HDSD tiếng Việt`,qty:`1 túi`,note:`Đầy đủ dụng cụ tự lắp đặt nhanh trong 20 phút`}]:i?[{name:`Thân lưng ghế & đệm ngồi công thái học`,qty:`1 kiện`,note:`Lưới kỹ thuật thoáng khí cao cấp chống biến dạng`},{name:`Piston thủy lực Class 4 chuẩn BIFMA`,qty:`1 chiếc`,note:`Đảm bảo an toàn tuyệt đối chịu lực đến 130kg`},{name:`Chân kim loại 5 cánh & 5 bánh xe PU mềm`,qty:`1 bộ`,note:`Bánh xe lăn êm, không gây trầy xước sàn gỗ`},{name:`Bộ tựa tay 3D đa hướng & gối tựa đầu`,qty:`1 bộ`,note:`Hỗ trợ đốt sống cổ và giải tỏa áp lực khớp vai`},{name:`Bộ vít lục giác chuyên dụng & Sách hướng dẫn`,qty:`1 túi`,note:`Lắp ráp dễ dàng với hướng dẫn trực quan từng bước`}]:a?[{name:`Thân đèn LED công nghệ bảo vệ thị lực`,qty:`1 chiếc`,note:`Chỉ số hoàn màu Ra ≥ 95, không phát xạ ánh sáng xanh`},{name:`Ngàm kẹp bàn chống trầy / Chân đế đối trọng`,qty:`1 bộ`,note:`Đệm silicon chống xước mặt bàn tuyệt đối`},{name:`Cáp cấp nguồn Type-C bọc dù cao cấp 1.8m`,qty:`1 sợi`,note:`Cung cấp nguồn điện ổn định, chống gãy gập`},{name:`Sách hướng dẫn sử dụng & Thẻ bảo hành chính hãng`,qty:`1 bộ`,note:`Kích hoạt bảo hành điện tử chính hãng EcoDesk`}]:[{name:`Chi tiết sản phẩm chính hãng EcoDesk`,qty:`1 chiếc`,note:`Gia công CNC hợp kim/gỗ nguyên khối tinh xảo`},{name:`Bộ đệm cao su silicon chống rung trượt`,qty:`1 bộ`,note:`Bám dính vững chắc trên mọi bề mặt bàn`},{name:`Khóa vặn lục giác & phụ kiện cố định đi kèm`,qty:`1 túi`,note:`Thao tác gắn kẹp không cần khoan đục mặt bàn`},{name:`Thẻ bảo hành & Hướng dẫn sử dụng`,qty:`1 chiếc`,note:`Hỗ trợ kỹ thuật 24/7 từ chuyên viên EcoDesk`}]}function ue(e,t=[]){let n=String(e?.name||``).toLowerCase(),r=n.includes(`ban`)||n.includes(`desk`),i=n.includes(`ghe`)||n.includes(`chair`),a=[];a=r?[`P008`,`P004`]:i?[`P008`,`P014`]:[`P008`,`P001`];let o=(t||[]).filter(t=>a.includes(t.id)&&t.id!==e?.id);return o.length===0&&(o=(t||[]).filter(t=>t.categoryId===`laptop`&&t.id!==e?.id).slice(0,2)),o.slice(0,2)}function E(t,r){let i=te(r,t.categoryId),c=a(t);c.percent;let l=re(t.id),_=l.count>0?l.average:0;ae(t.id);let v=se(t,i),ne=ce(t),ie=le(t),b=Array.isArray(t?.variants)?t.variants:[];if(b.length===0&&t?.variantsJson)try{let e=typeof t.variantsJson==`string`?JSON.parse(t.variantsJson):t.variantsJson;Array.isArray(e)&&(b=e)}catch{}let x=Array.isArray(t?.attributes)?t.attributes:[];if(x.length===0&&t?.attributesJson)try{let e=typeof t.attributesJson==`string`?JSON.parse(t.attributesJson):t.attributesJson;Array.isArray(e)&&(x=e)}catch{}b=b.map((e,n)=>({id:e?.id||`${t.id}-VAR-${n+1}`,name:e?.name||`Phiên bản ${n+1}`,sku:e?.sku||`${t.id}-SKU-${n+1}`,price:Number(e?.price??t?.price??0),stock:Math.max(0,Number(e?.stock??0)),options:e?.options&&typeof e.options==`object`?e.options:{},image:e?.image||t?.image||``}));let S=oe(t,b),C=[];x.length>0&&(C=x.filter(e=>e&&e.name&&Array.isArray(e.values)&&e.values.length>0)),C.length===0&&b.length>0&&(C=Object.keys(b[0]?.options||{}).map(e=>{let t=new Set;return b.forEach(n=>{n.options&&n.options[e]&&t.add(n.options[e])}),{name:e,values:Array.from(t)}}));let w=b.length>0&&C.length>0,T=null,E=!1,D={};if(w){let e=ee(`variant`),t=e?b.find(t=>String(t.id)===String(e)||String(t.sku)===String(e)):null;E=!!t,T=t||b.find(e=>Number(e.stock)>0)||b[0],T&&T.options&&(D={...T.options}),C.forEach(e=>{!D[e.name]&&Array.isArray(e.values)&&e.values.length>0&&(D[e.name]=e.values[0])})}let O=Number(T?T.stock:t?.stock||0),de=Number(T?T.price:t?.price||0),k=a({...t||{},price:de}),A=O>0,me=w?b.every(e=>Number(e.stock)<=0):Number(t?.stock||0)<=0,he=s(),ge=ue(t,he),_e=he.filter(e=>e.id!==t.id).sort((e,n)=>e.categoryId===t.categoryId?-1:1).slice(0,4),j=E&&T?.image||t.image||S[0]&&S[0].url||T&&T.image||`./images/ban-nang-ha-mat-go.png`,ve=S.find(e=>e.url===j)||S[0]||{},ye=Math.max(0,S.findIndex(e=>e.url===j));o(`#detailRoot`).innerHTML=`
    <div class="pdp-page">
      <!-- 1. Breadcrumb Navigation -->
      <nav class="pdp-breadcrumb" aria-label="Đường dẫn trang">
        <ol class="pdp-breadcrumb-list">
          <li><a href="./index.html">Trang chủ</a></li>
          <li class="pdp-breadcrumb-sep">/</li>
          <li><a href="./products.html?category=${t.categoryId}">${i}</a></li>
          <li class="pdp-breadcrumb-sep">/</li>
          <li class="pdp-breadcrumb-current" aria-current="page">${t.name}</li>
        </ol>
      </nav>

      <!-- 2. Main Hero Grid -->
      <div class="pdp-hero-grid">
        <!-- Left Column: Gallery & Package Modules -->
        <div class="pdp-gallery-card">
          <div class="pdp-main-image-wrap" id="mainImageWrap" title="Bấm để phóng to ảnh">
            <div class="pdp-badge-stack">
              <span class="pdp-badge pdp-badge-brand">EcoDesk</span>
              ${k.percent?`<span class="pdp-badge pdp-badge-sale">${k.badgeText||`-${k.percent}%`}</span>`:``}
              ${e(t)?`<span class="pdp-badge" style="background: #1f7a5c; color: #fff; font-weight: 800;">Mới</span>`:``}
              ${g(t.tags).slice(0,2).map(e=>`<span class="pdp-badge pdp-badge-tag">${u(e)}</span>`).join(``)}
            </div>

            <!-- Mũi tên Previous ảnh chính (Chuẩn như ảnh mẫu tham khảo) -->
            <button type="button" class="pdp-main-nav-btn prev" id="mainPrevBtn" aria-label="Xem ảnh trước">
              ${h(`chevron-left`,{size:22,strokeWidth:2.2})}
            </button>

            <img id="mainDisplayImg" class="pdp-main-image" src="${j}" alt="${t.name}">

            <!-- Mũi tên Next ảnh chính (Chuẩn như ảnh mẫu tham khảo) -->
            <button type="button" class="pdp-main-nav-btn next" id="mainNextBtn" aria-label="Xem ảnh kế tiếp">
              ${h(`chevron-right`,{size:22,strokeWidth:2.2})}
            </button>

            <button type="button" class="pdp-zoom-btn" id="zoomLightboxBtn" aria-label="Phóng to ảnh">
              ${h(`zoom-in`,{size:18,strokeWidth:2})}
            </button>
            <div class="pdp-image-meta-bar">
              <span class="pdp-image-caption" id="pdpImageCaption">${u(ve.caption||T?.name||t.name)}</span>
              <span class="pdp-image-counter" id="pdpImageCounter">${ye+1} / ${S.length}</span>
            </div>
          </div>

          <!-- Thumbnails Strip Carousel with Navigation Arrows (Chuẩn như ảnh mẫu tham khảo) -->
          <div class="pdp-thumb-carousel-wrap">
            <button type="button" class="pdp-thumb-nav-btn prev" id="thumbPrevBtn" aria-label="Cuộn thumbnail sang trái">
              ${h(`chevron-left`,{size:16,strokeWidth:2.2})}
            </button>

            <div class="pdp-thumb-list" id="thumbList" role="tablist" aria-label="Hình ảnh sản phẩm">
              ${S.map((e,n)=>`
                  <button type="button" class="pdp-thumb-btn ${n===ye?`is-active`:``}"
                    data-idx="${n}"
                    data-src="${e.url}"
                    data-is-general="${e.isGeneral?`true`:`false`}"
                    data-attr-key="${u(e.attributeKey||``)}"
                    data-attr-val="${u(e.attributeValue||``)}"
                    data-variant-id="${u(e.variantId||``)}"
                    aria-label="${u(e.caption||`Ảnh ${n+1}`)}">
                    <img src="${e.url}" alt="${u(t.name)} ảnh ${n+1}">
                    <span class="pdp-thumb-variant-tag ${e.isGeneral?`general`:`variant`}">${u(e.tag||e.attributeValue||`Chung`)}</span>
                  </button>
                `).join(``)}
            </div>

            <button type="button" class="pdp-thumb-nav-btn next" id="thumbNextBtn" aria-label="Cuộn thumbnail sang phải">
              ${h(`chevron-right`,{size:16,strokeWidth:2.2})}
            </button>
          </div>

          <!-- 3. What's in the Box / Package Contents -->
          <div class="pdp-box-contents-card">
            <div class="pdp-box-header">
              <div class="pdp-box-title-wrap">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                <span class="pdp-box-title">Trong hộp bao gồm</span>
              </div>
              <span class="pdp-box-badge">Quy cách đóng gói</span>
            </div>
            <ul class="pdp-box-list">
              ${ie.map(e=>`
                <li class="pdp-box-item">
                  <div class="pdp-box-item-bullet">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div class="pdp-box-item-body">
                    <div class="pdp-box-item-name">
                      <strong>${e.name}</strong>
                      <span class="pdp-box-qty">${e.qty}</span>
                    </div>
                    <span class="pdp-box-item-note">${e.note}</span>
                  </div>
                </li>
              `).join(``)}
            </ul>
            <div class="pdp-box-footer">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Đóng gói màng xốp 3 lớp chống sốc, niêm phong kiểm định an toàn vận chuyển toàn quốc.</span>
            </div>
          </div>
        </div>

        <!-- Right Column: Purchasing Info -->
        <section class="pdp-info-panel">
          <div class="pdp-meta-header">
            <a href="./products.html?category=${t.categoryId}" class="pdp-category-link">${i}</a>
            <span class="pdp-sku-text" id="pdpSkuText">Mã SP: ${T?.sku||t.id}</span>
          </div>

          <h1 class="pdp-product-title">${t.name}</h1>

          <!-- Rating & Sales Bar -->
          <div class="pdp-rating-row" id="pdpTopRatingRow">
            <span class="pdp-stars" id="pdpTopRatingStars" aria-label="${l.count>0?`${_.toFixed(1)} sao`:`Chưa có đánh giá`}" ${l.count>0?``:`hidden`}>
              ${l.count>0?y(_):``}
            </span>
            <span class="pdp-rating-score" id="pdpTopRatingScore">${l.count>0?`${_.toFixed(1)} / 5`:`Chưa có đánh giá`}</span>
            <a href="#reviewsSection" class="pdp-rating-count-link" id="jumpToReviewsLink" ${l.count>0?``:`hidden`}>(${l.count} đánh giá)</a>
            <span class="pdp-rating-sep">•</span>
            <span class="pdp-sold-text">Đã bán: <strong>${t.sold}</strong></span>
          </div>

          <!-- Price Box -->
          <div class="pdp-price-box">
            <div class="pdp-price-main-row">
              <span class="pdp-current-price" id="displayCurrentPrice">${m(k.price)}</span>
              <del class="pdp-original-price" id="displayOriginalPrice" style="${k.percent?``:`display: none;`}">${m(k.original)}</del>
              <span class="pdp-price-percent" id="displayPricePercent" style="${k.percent?``:`display: none;`}">Tiết kiệm ${k.percent}%</span>
            </div>
            <p class="pdp-vat-note">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Giá đã bao gồm thuế VAT • Cam kết 100% sản phẩm chính hãng EcoDesk
            </p>
          </div>

          <!-- Short Description -->
          <p class="pdp-lead-desc">${t.description}</p>

          <!-- Stock Status -->
          <div class="pdp-stock-status ${A?`in-stock`:`out-of-stock`}" id="pdpStockStatusWrap">
            <span class="pdp-pulse-dot"></span>
            <span id="pdpStockStatusText">${A?`Tình trạng: Còn hàng (${O} sản phẩm sẵn sàng giao)`:`Tạm hết hàng`}</span>
          </div>

          <!-- Variants Selection (Hiển thị động theo thuộc tính sản phẩm) -->
          ${w?`
            <div class="pdp-variants-wrap" id="pdpVariantsContainer">
              ${C.map(e=>{let t=/màu|color/i.test(e.name);return`
                  <div class="pdp-variant-group" data-group-attr="${u(e.name)}">
                    <div class="pdp-variant-label">
                      ${u(e.name)}: <span class="pdp-variant-selected-val" id="selectedLabel_${u(e.name)}">${u(D[e.name]||``)}</span>
                    </div>
                    <div class="pdp-options-row">
                      ${(e.values||[]).map(n=>{let r=n===D[e.name],i=t?f(n):null;return`
                          <button type="button" class="pdp-opt-btn ${t?`pdp-opt-color`:``} ${r?`is-selected`:``}" data-attr="${u(e.name)}" data-val="${u(n)}">
                            ${i?`<span class="pdp-opt-swatch" style="background:${i.hex}; border-color:${i.border};" aria-hidden="true"></span>`:``}
                            <span class="pdp-opt-text">${u(n)}</span>
                          </button>
                        `}).join(``)}
                    </div>
                  </div>
                `}).join(``)}
            </div>
          `:``}

          <!-- Cảnh báo khi sản phẩm / biến thể tạm hết hàng -->
          <div id="variantStockAlert" class="pdp-variant-alert" style="${A?`display: none;`:`display: block;`}">
            <span style="display:inline-flex; vertical-align:-2px; margin-right:4px;">${h(`alert-triangle`,{size:16,strokeWidth:2})}</span>
            ${w?me?`Tất cả các phiên bản của sản phẩm này hiện đã tạm hết hàng. Quý khách vui lòng quay lại sau.`:`Lựa chọn "${u(T?.name||``)}" hiện đã tạm hết hàng (tồn kho: 0). Quý khách vui lòng chọn màu sắc hoặc phiên bản khác còn hàng.`:`Mẫu này hiện đã hết hàng. Quý khách vui lòng quay lại sau hoặc liên hệ hỗ trợ.`}
          </div>

          <!-- Quantity & Purchase Action Buttons -->
          <div class="pdp-purchase-actions">
            <div class="pdp-qty-row">
              <span class="pdp-qty-label">Số lượng:</span>
              <div class="pdp-qty-stepper">
                <button type="button" class="pdp-qty-btn" id="qtyMinusBtn" aria-label="Giảm số lượng">-</button>
                <input type="number" id="qtyInput" class="pdp-qty-input" value="1" min="1" max="${O}" aria-label="Số lượng sản phẩm">
                <button type="button" class="pdp-qty-btn" id="qtyPlusBtn" aria-label="Tăng số lượng">+</button>
              </div>
              <span class="pdp-qty-hint" id="pdpQtyHint" style="font-size: 0.82rem; color: #64748b;">(Tối đa: ${O} chiếc)</span>
            </div>

            <div class="pdp-btn-group" style="display: flex; gap: 10px; align-items: stretch;">
              <button type="button" id="addToCartBtn" class="pdp-btn-add-cart" ${A?``:`disabled`} style="flex: 2;">
                ${h(`shopping-bag`,{size:20,strokeWidth:2})}
                <span>Thêm vào giỏ hàng</span>
              </button>
              <button type="button" id="buyNowBtn" class="pdp-btn-buy-now" ${A?``:`disabled`} style="flex: 1.5;">
                ${h(`zap`,{size:19,strokeWidth:2})}
                <span>Mua ngay</span>
              </button>
              <button type="button" class="pdp-btn-wishlist" data-wishlist-btn data-product-id="${t.id}" title="Lưu vào danh sách yêu thích" aria-label="Yêu thích" style="flex: 0 0 48px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer; transition: all 0.2s;">
                <span class="wishlist-icon" style="display: flex; align-items: center; justify-content: center;">${h(`heart`,{size:20,class:`wishlist-heart-svg`})}</span>
              </button>
            </div>
          </div>

          <!-- 3. Peace of Mind / Trust Blocks -->
          <div class="pdp-trust-grid">
            <div class="pdp-trust-card">
              ${h(`truck`,{size:22,strokeWidth:1.8,class:`pdp-trust-icon`})}
              <div>
                <h4>Giao hàng & Lắp đặt</h4>
                <p>Miễn phí vận chuyển & lắp đặt nội thành TP.HCM. Toàn quốc cho đơn từ 2.000.000đ.</p>
              </div>
            </div>

            <div class="pdp-trust-card">
              ${h(`shield-check`,{size:22,strokeWidth:1.8,class:`pdp-trust-icon`})}
              <div>
                <h4>Bảo hành chính hãng</h4>
                <p>Bảo hành điện tử tự động kích hoạt theo số điện thoại mua hàng.</p>
              </div>
            </div>

            <div class="pdp-trust-card">
              ${h(`refresh-cw`,{size:22,strokeWidth:1.8,class:`pdp-trust-icon`})}
              <div>
                <h4>Đổi trả an tâm</h4>
                <p>Hỗ trợ đổi mới linh hoạt nếu phát sinh lỗi kỹ thuật từ nhà sản xuất.</p>
              </div>
            </div>

            <div class="pdp-trust-card">
              ${h(`phone-call`,{size:22,strokeWidth:1.8,class:`pdp-trust-icon`})}
              <div>
                <h4>Tư vấn chuyên sâu</h4>
                <p>Hotline <strong>1900 1234</strong> (09:00 - 21:00) sẵn sàng giải đáp kỹ thuật.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- 2.5. Sub-Hero 2-Column Balanced Section -->
      <div class="pdp-subhero-grid">
        <!-- Left: Add-on Accessory Suggestions -->
        ${ge.length>0?`
          <div class="pdp-addon-card">
            <div class="pdp-addon-header">
              <div class="pdp-addon-title-wrap">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span class="pdp-addon-title">Gợi ý phụ kiện hoàn thiện setup</span>
              </div>
              <span class="pdp-addon-badge">Tương thích 100%</span>
            </div>
            <p class="pdp-addon-subtitle">Thường được chọn mua cùng để tối ưu không gian làm việc gọn gàng:</p>
            <div class="pdp-addon-list">
              ${ge.map(e=>{let t=a(e),n=Array.isArray(e.variants)&&e.variants.length>0,r=n?e.variants.reduce((e,t)=>e+Math.max(0,Number(t.stock)||0),0):Math.max(0,Number(e.stock)||0);return`
                  <div class="pdp-addon-item">
                    <a href="./detail.html?id=${e.id}" class="pdp-addon-thumb-link" title="Xem ${u(e.name)}">
                      <img src="${e.image}" alt="${u(e.name)}" class="pdp-addon-thumb">
                    </a>
                    <div class="pdp-addon-info">
                      <a href="./detail.html?id=${e.id}" class="pdp-addon-name">${u(e.name)}</a>
                      <div class="pdp-addon-price-row">
                        <span class="pdp-addon-price">${n?`Từ ${m(t.price)}`:m(t.price)}</span>
                        ${t.percent>0?`<span class="pdp-addon-sale">-${t.percent}%</span>`:``}
                      </div>
                    </div>
                    ${n?`<a href="./detail.html?id=${e.id}" class="pdp-addon-add-btn pdp-addon-select-link" title="Chọn phân loại cho ${u(e.name)}">Chọn loại</a>`:`<button type="button" class="pdp-addon-add-btn" data-id="${e.id}" data-name="${u(e.name)}" ${r<=0?`disabled`:``} title="${r<=0?`Tạm hết hàng`:`Thêm phụ kiện này vào giỏ hàng`}">
                          ${r<=0?`<span>Hết hàng</span>`:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                               <span>+ Thêm</span>`}
                        </button>`}
                  </div>
                `}).join(``)}
            </div>
          </div>
        `:``}

        <!-- Right: Showroom & Direct Consultation Banner -->
        <div class="pdp-showroom-card">
          <div class="pdp-showroom-header">
            <div class="pdp-showroom-title-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span class="pdp-showroom-title">Trải nghiệm trực tiếp tại Showroom EcoDesk</span>
            </div>
            <span class="pdp-showroom-status"><span class="pdp-dot-live"></span> Đang mở cửa (09:00 - 21:00)</span>
          </div>
          <div class="pdp-showroom-branches">
            <div class="pdp-branch-item">
              <span class="pdp-branch-pin" style="display:inline-flex; align-items:center; color: var(--color-primary);">${h(`map-pin`,{size:16,strokeWidth:2})}</span>
              <span class="pdp-branch-text"><strong>Showroom TP.HCM:</strong> 123 Nguyễn Thị Minh Khai, P. Bến Thành, Q.1</span>
            </div>
            <div class="pdp-branch-item">
              <span class="pdp-branch-pin" style="display:inline-flex; align-items:center; color: var(--color-primary);">${h(`map-pin`,{size:16,strokeWidth:2})}</span>
              <span class="pdp-branch-text"><strong>Showroom Hà Nội:</strong> 45 Thái Hà, P. Trung Liệt, Q. Đống Đa</span>
            </div>
          </div>
          <div class="pdp-showroom-footer">
            <div class="pdp-showroom-hotline">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span>Hotline demo & tư vấn lắp đặt: <strong>1900 1234</strong> (Miễn cước)</span>
            </div>
            <a href="./payment-support.html" class="pdp-showroom-link">Xem hỗ trợ khách hàng →</a>
          </div>
        </div>
      </div>

      <!-- 4. Detailed Product Information Tabs -->
      <section class="pdp-tabs-section" id="detailsSection">
        <div class="pdp-tab-nav" role="tablist">
          <button type="button" class="pdp-tab-btn is-active" data-tab="tab-overview" role="tab" aria-selected="true">Mô tả & Lợi ích</button>
          <button type="button" class="pdp-tab-btn" data-tab="tab-features" role="tab" aria-selected="false">Tính năng nổi bật</button>
          ${v.length>0?`<button type="button" class="pdp-tab-btn" data-tab="tab-specs" role="tab" aria-selected="false">Thông số kỹ thuật</button>`:``}
          ${w?`<button type="button" class="pdp-tab-btn" data-tab="tab-variants" role="tab" aria-selected="false">Phiên bản & Tồn kho (${b.length})</button>`:``}
          <button type="button" class="pdp-tab-btn" data-tab="tab-guide" role="tab" aria-selected="false">Hướng dẫn lắp đặt & Sử dụng</button>
          <button type="button" class="pdp-tab-btn" data-tab="tab-policy" role="tab" aria-selected="false">Chính sách & Hậu mãi</button>
        </div>

        <!-- Tab 1: Overview -->
        <div class="pdp-tab-panel is-active" id="tab-overview" role="tabpanel">
          <div class="pdp-overview-content">
            <p><strong>${t.name}</strong> là giải pháp công thái học cao cấp được nghiên cứu và phát triển để tối ưu hóa không gian làm việc cho người Việt. Sản phẩm không chỉ mang lại nét thẩm mỹ hiện đại, tinh giản mà còn chủ động bảo vệ sức khỏe cột sống, phòng ngừa tình trạng đau mỏi cổ vai gáy khi phải ngồi làm việc liên tục trong nhiều giờ.</p>
            <p>${t.description}</p>

            <div class="pdp-benefits-grid">
              <div class="pdp-benefit-box">
                <div class="pdp-benefit-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </div>
                <h4>Tư thế lành mạnh</h4>
                <p>Thiết kế chuẩn sinh học giúp duy trì đường cong sinh lý tự nhiên, giải tỏa áp lực đĩa đệm và tăng cường lưu thông tuần hoàn máu.</p>
              </div>

              <div class="pdp-benefit-box">
                <div class="pdp-benefit-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                </div>
                <h4>Không gian gọn gàng</h4>
                <p>Tối ưu hóa diện tích mặt bàn, tương thích hoàn hảo với các hệ thống quản lý dây cáp và phụ kiện kẹp bàn EcoDesk.</p>
              </div>

              <div class="pdp-benefit-box">
                <div class="pdp-benefit-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                </div>
                <h4>Bền bỉ dài lâu</h4>
                <p>Vật liệu tuyển chọn chịu tải cao, đã qua hàng ngàn chu kỳ thử nghiệm áp lực nghiêm ngặt trước khi đến tay người tiêu dùng.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: Features -->
        <div class="pdp-tab-panel" id="tab-features" role="tabpanel">
          <div class="pdp-features-grid">
            <div class="pdp-feature-card">
              <div class="pdp-feature-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <h4>Chất liệu hoàn thiện tinh tế</h4>
              </div>
              <p>Từng góc cạnh, khớp nối và bề mặt sơn tĩnh điện được hoàn thiện tỉ mỉ, đem lại cảm giác cầm chạm êm ái, chống trầy xước và bám vân tay.</p>
            </div>

            <div class="pdp-feature-card">
              <div class="pdp-feature-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <h4>Độ an toàn và ổn định vượt trội</h4>
              </div>
              <p>Khung gầm và kết cấu chịu lực đạt chuẩn tải trọng cao, không rung lắc khi gõ phím hay nâng hạ ở điểm cao nhất.</p>
            </div>

            <div class="pdp-feature-card">
              <div class="pdp-feature-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                <h4>Tùy biến linh hoạt theo vóc dáng</h4>
              </div>
              <p>Mọi cơ chế điều chỉnh đều được tối giản hóa để người dùng thao tác mượt mà chỉ bằng một nút bấm hoặc chạm nhẹ.</p>
            </div>

            <div class="pdp-feature-card">
              <div class="pdp-feature-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                <h4>Hệ sinh thái đồng bộ EcoDesk</h4>
              </div>
              <p>Dễ dàng kết hợp cùng tay nâng màn hình, kệ đỡ laptop, khay đi dây và đèn bảo vệ thị lực để tạo nên một góc làm việc hoàn hảo.</p>
            </div>
          </div>
        </div>

        <!-- Tab 3: Technical Specifications -->
        <div class="pdp-tab-panel" id="tab-specs" role="tabpanel">
          <div class="pdp-specs-table-wrap">
            <table class="pdp-specs-table">
              <tbody>
                ${v.map(e=>`
                  <tr>
                    <td>${u(e.label)}</td>
                    <td>${u(e.value)}</td>
                  </tr>
                `).join(``)}
              </tbody>
            </table>
          </div>
        </div>

        ${w?`
          <!-- Tab 3.5: Variant Comparison Matrix -->
          <div class="pdp-tab-panel" id="tab-variants" role="tabpanel">
            <div class="pdp-specs-table-wrap">
              <table class="pdp-specs-table pdp-variant-matrix-table">
                <thead>
                  <tr>
                    <th>Phiên bản / Thuộc tính</th>
                    <th>Mã SKU</th>
                    <th>Giá bán</th>
                    <th>Tồn kho</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${b.map(e=>{let n=a({...t,price:e.price},new Date,e),r=Math.max(0,Number(e.stock)||0);return`
                      <tr>
                        <td><strong>${u(e.name)}</strong></td>
                        <td><code>${u(e.sku)}</code></td>
                        <td>
                          <strong>${m(n.price)}</strong>
                          ${n.percent?`<del style="margin-left:6px; color:#94a3b8; font-size:0.82rem;">${m(n.original)}</del>`:``}
                        </td>
                        <td>
                          <span class="pdp-matrix-stock ${r>0?`in`:`out`}">
                            ${r>0?`Còn ${r}`:`Tạm hết hàng`}
                          </span>
                        </td>
                        <td style="text-align:right;">
                          <button type="button" class="btn-outline pdp-matrix-pick-btn" data-pick-variant-id="${u(e.id)}">
                            Chọn mẫu này
                          </button>
                        </td>
                      </tr>
                    `}).join(``)}
                </tbody>
              </table>
            </div>
          </div>
        `:``}

        <!-- Tab 4: Installation Guide -->
        <div class="pdp-tab-panel" id="tab-guide" role="tabpanel">
          <div class="pdp-steps-timeline">
            <div class="pdp-step-item">
              <div class="pdp-step-num">1</div>
              <div class="pdp-step-body">
                <h4>Kiểm tra kiện hàng & Tháo mở bao bì</h4>
                <p>Mở hộp cẩn thận trên mặt phẳng sạch, kiểm tra đầy đủ các linh kiện, ốc vít và phụ kiện lắp đặt theo danh mục hướng dẫn đính kèm.</p>
              </div>
            </div>

            <div class="pdp-step-item">
              <div class="pdp-step-num">2</div>
              <div class="pdp-step-body">
                <h4>Lắp ráp khung đỡ & Cố định kết cấu</h4>
                <p>Sử dụng bộ dụng cụ lục giác được cung cấp để siết chặt các khớp nối theo sơ đồ đánh số thứ tự từ chân đế lên khung chính.</p>
              </div>
            </div>

            <div class="pdp-step-item">
              <div class="pdp-step-num">3</div>
              <div class="pdp-step-body">
                <h4>Cân chỉnh & Thiết lập vị trí làm việc</h4>
                <p>Điều chỉnh chân đế chống bập bênh, cắm nguồn điện (nếu có thiết bị điện tử) và ghi nhớ các nấc vị trí phù hợp với chiều cao cơ thể.</p>
              </div>
            </div>

            <div class="pdp-step-item">
              <div class="pdp-step-num">4</div>
              <div class="pdp-step-body">
                <h4>Bảo quản định kỳ</h4>
                <p>Lau chùi bằng khăn mềm ẩm, tránh đổ trực tiếp dung môi tẩy rửa mạnh lên bề mặt gỗ hoặc các cụm phím điều khiển điện.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 5: Warranty Policy -->
        <div class="pdp-tab-panel" id="tab-policy" role="tabpanel">
          <div class="pdp-overview-content">
            <h4>Chính sách bảo hành chính hãng EcoDesk</h4>
            <p>Mọi sản phẩm của EcoDesk đều được áp dụng hệ thống bảo hành điện tử chính hãng thông qua số điện thoại đặt hàng. Khi có yêu cầu bảo hành hoặc sửa chữa kỹ thuật, bạn không cần giữ hóa đơn giấy tờ phức tạp.</p>
            <ul>
              <li><strong>Thời gian tiếp nhận:</strong> Trong vòng 24h làm việc kể từ khi nhận được thông báo lỗi.</li>
              <li><strong>Điều kiện bảo hành:</strong> Lỗi kỹ thuật hoặc hư hỏng phát sinh do nhà sản xuất trong quá trình sử dụng bình thường.</li>
              <li><strong>Kênh tiếp nhận:</strong> Hotline <strong>1900 1234</strong> hoặc gửi yêu cầu tra soát tại <a href="./payment-support.html" style="color: var(--pdp-primary); font-weight: 700;">Trung tâm hỗ trợ khách hàng EcoDesk</a>.</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 5. Reviews & FAQs Section -->
      <div class="pdp-reviews-faq-wrap" id="reviewsSection">
        <!-- Customer Reviews Box -->
        <div class="pdp-box-card" id="pdpReviewsCard">
          ${fe(t)}
        </div>

        <!-- FAQs Box -->
        <div class="pdp-box-card">
          <h3 class="pdp-section-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Câu hỏi thường gặp
          </h3>

          <div class="pdp-faq-list">
            ${ne.map((e,t)=>`
              <div class="pdp-faq-item ${t===0?`is-open`:``}">
                <button type="button" class="pdp-faq-question">
                  <span>${e.q}</span>
                  <svg class="pdp-faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="pdp-faq-answer">
                  <p>${e.a}</p>
                </div>
              </div>
            `).join(``)}
          </div>
        </div>
      </div>

      <!-- 6. Related Products -->
      <section class="pdp-related-section">
        <h3 class="pdp-section-title" style="margin-bottom: 24px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Sản phẩm liên quan & Thường mua cùng
        </h3>

        <div class="pdp-related-grid">
          ${_e.map(t=>{let n=a(t);return`
              <article class="product-card">
                <a class="product-image" href="./detail.html?id=${t.id}">
                  <img src="${t.image}" alt="${t.name}" loading="lazy">
                </a>
                <div class="product-body">
                  <div class="badge-row">
                    ${e(t)?`<span class="badge" style="background:#1f7a5c;color:#fff;">Mới</span>`:``}
                    ${g(t.tags).slice(0,1).map(e=>`<span class="badge">${u(e)}</span>`).join(``)}
                  </div>
                  <h3><a href="./detail.html?id=${t.id}">${t.name}</a></h3>
                  <div class="product-meta">
                    <span class="price">${m(n.price)}</span>
                    ${n.percent?`<span class="badge badge-sale">-${n.percent}%</span>`:``}
                  </div>
                  <div class="product-foot">
                    <button class="btn btn-outline" onclick="window.location.href='./detail.html?id=${t.id}'" type="button">Xem chi tiết</button>
                  </div>
                </div>
              </article>
            `}).join(``)}
        </div>
      </section>

      <!-- 7. Lightbox Zoom Modal with Prev/Next Controls -->
      <div class="pdp-lightbox" id="pdpLightbox" role="dialog" aria-modal="true" aria-label="Xem ảnh lớn">
        <button type="button" class="pdp-lightbox-nav prev" id="lightboxPrevBtn" aria-label="Xem ảnh trước">${h(`chevron-left`,{size:28,strokeWidth:2})}</button>
        <div class="pdp-lightbox-content">
          <button type="button" class="pdp-lightbox-close" id="lightboxCloseBtn" aria-label="Đóng (ESC)">${h(`x`,{size:24,strokeWidth:2})}</button>
          <img id="lightboxImg" src="${j}" alt="${t.name}">
          <div class="pdp-lightbox-counter" id="lightboxCounter">1 / ${S.length}</div>
        </div>
        <button type="button" class="pdp-lightbox-nav next" id="lightboxNextBtn" aria-label="Xem ảnh kế tiếp">${h(`chevron-right`,{size:28,strokeWidth:2})}</button>
      </div>

      <!-- 8. Sticky Mobile Buy Bar -->
      <div class="pdp-sticky-bar" id="mobileStickyBar">
        <div class="pdp-sticky-info">
          <img src="${j}" alt="${t.name}" class="pdp-sticky-thumb">
          <div class="pdp-sticky-text">
            <span class="pdp-sticky-title">${t.name}</span>
            <span class="pdp-sticky-price">${m(c.price)}</span>
          </div>
        </div>
        <div class="pdp-sticky-actions">
          <button type="button" class="pdp-sticky-btn-cart" id="mobileAddCartBtn" ${A?``:`disabled`}>Thêm giỏ</button>
          <button type="button" class="pdp-sticky-btn-buy" id="mobileBuyNowBtn" ${A?``:`disabled`}>Mua ngay</button>
        </div>
      </div>
    </div>
  `;let M=o(`#mainDisplayImg`),N=o(`#pdpLightbox`),P=o(`#lightboxImg`),be=o(`#lightboxCloseBtn`),F=0,xe=S.findIndex(e=>e.url===j);xe!==-1&&(F=xe);let I=(e,{syncVariant:n=!0,scrollThumb:r=!0}={})=>{if(!S||S.length===0)return;F=(e+S.length)%S.length;let i=S[F];if(!i)return;M&&(M.style.opacity=`0.5`,M.src=i.url,setTimeout(()=>{M&&(M.style.opacity=`1`)},120)),P&&(P.src=i.url);let a=o(`#pdpImageCounter`);a&&(a.textContent=`${F+1} / ${S.length}`);let s=o(`#pdpImageCaption`);s&&(s.textContent=i.caption||t.name);let c=o(`#lightboxCounter`);if(c&&(c.textContent=`${F+1} / ${S.length}`),document.querySelectorAll(`.pdp-thumb-btn`).forEach((e,t)=>{t===F?(e.classList.add(`is-active`),r&&e.scrollIntoView({behavior:`smooth`,block:`nearest`,inline:`center`})):e.classList.remove(`is-active`)}),n&&!i.isGeneral&&w){if(i.variantId){let e=(b||[]).find(e=>e.id===i.variantId);if(e&&e.options){Object.assign(D,e.options),Q({skipImageChange:!0});return}}i.attributeKey&&i.attributeValue&&(D[i.attributeKey]=i.attributeValue,Q({skipImageChange:!0}))}};document.querySelectorAll(`.pdp-thumb-btn`).forEach(e=>{e.addEventListener(`click`,()=>{let t=Number(e.getAttribute(`data-idx`)||0);I(t,{syncVariant:!0,scrollThumb:!0})})}),o(`#mainPrevBtn`)?.addEventListener(`click`,e=>{e.stopPropagation(),I(F-1,{syncVariant:!0,scrollThumb:!0})}),o(`#mainNextBtn`)?.addEventListener(`click`,e=>{e.stopPropagation(),I(F+1,{syncVariant:!0,scrollThumb:!0})}),o(`#thumbPrevBtn`)?.addEventListener(`click`,e=>{e.stopPropagation(),o(`#thumbList`)?.scrollBy({left:-220,behavior:`smooth`})}),o(`#thumbNextBtn`)?.addEventListener(`click`,e=>{e.stopPropagation(),o(`#thumbList`)?.scrollBy({left:220,behavior:`smooth`})}),o(`#lightboxPrevBtn`)?.addEventListener(`click`,e=>{e.stopPropagation(),I(F-1,{syncVariant:!0,scrollThumb:!0})}),o(`#lightboxNextBtn`)?.addEventListener(`click`,e=>{e.stopPropagation(),I(F+1,{syncVariant:!0,scrollThumb:!0})}),document.addEventListener(`keydown`,e=>{N.classList.contains(`is-open`)&&(e.key===`ArrowLeft`?I(F-1,{syncVariant:!0,scrollThumb:!0}):e.key===`ArrowRight`&&I(F+1,{syncVariant:!0,scrollThumb:!0}))});let Se=()=>{N.classList.add(`is-open`),document.body.style.overflow=`hidden`},L=()=>{N.classList.remove(`is-open`),document.body.style.overflow=``},R=!1,Ce=(e,t,n)=>{if(!e)return;let r=0,i=0;e.addEventListener(`touchstart`,e=>{e.touches&&e.touches.length===1&&(r=e.touches[0].clientX,i=e.touches[0].clientY,R=!1)},{passive:!0}),e.addEventListener(`touchend`,e=>{if(!e.changedTouches||e.changedTouches.length!==1)return;let a=e.changedTouches[0].clientX-r,o=e.changedTouches[0].clientY-i;Math.abs(a)>=42&&Math.abs(a)>Math.abs(o)*1.2&&(R=!0,a<0?t():n())},{passive:!0})},we=o(`#mainImageWrap`);Ce(we,()=>I(F+1,{syncVariant:!0,scrollThumb:!0}),()=>I(F-1,{syncVariant:!0,scrollThumb:!0})),Ce(N,()=>I(F+1,{syncVariant:!0,scrollThumb:!0}),()=>I(F-1,{syncVariant:!0,scrollThumb:!0})),we.addEventListener(`click`,()=>{R?R=!1:Se()}),o(`#zoomLightboxBtn`).addEventListener(`click`,e=>{e.stopPropagation(),Se()}),be.addEventListener(`click`,L),N.addEventListener(`click`,e=>{e.target===N&&L()}),document.addEventListener(`keydown`,e=>{e.key===`Escape`&&N.classList.contains(`is-open`)&&L()});let z=T,B=o(`#qtyInput`),V=o(`#qtyMinusBtn`),H=o(`#qtyPlusBtn`),U=o(`#pdpStockStatusWrap`),W=o(`#pdpStockStatusText`),G=o(`#variantStockAlert`),Te=o(`#pdpSkuText`),Ee=o(`#displayCurrentPrice`),De=o(`#displayOriginalPrice`),Oe=o(`#displayPricePercent`),K=o(`#pdpQtyHint`),q=o(`#addToCartBtn`),J=o(`#buyNowBtn`),Y=o(`#mobileAddCartBtn`),X=o(`#mobileBuyNowBtn`),ke=document.querySelector(`#mobileStickyBar .pdp-sticky-price`),Z=(e,t)=>{V&&(V.disabled=e<=1||t<=0),H&&(H.disabled=e>=t||t<=0)},Q=(e={})=>{let n=s().find(e=>String(e.id)===String(t.id))||t,r=0,i=Number(n.price||0),o=!1,c=``;w?(z=(n.variants||[]).find(e=>e.options?Object.entries(D).every(([t,n])=>e.options[t]===n):!1)||null,z?(r=Math.max(0,Number(z.stock)||0),i=z.price!=null&&!isNaN(z.price)?Number(z.price):Number(n.price||0),c=z.name):(o=!0,r=0)):(r=Math.max(0,Number(n.stock)||0),c=n.name);let l=a({...n,price:i},new Date,z);if(Ee&&(Ee.textContent=o?`—`:m(l.price)),ke&&(ke.textContent=o?`—`:m(l.price)),De&&(De.textContent=m(l.original),De.style.display=!o&&l.percent?``:`none`),Oe){let e=l.savings?`Tiết kiệm ${m(l.savings)} (${l.percent}%)`:`Tiết kiệm ${l.percent}%`;Oe.textContent=e,Oe.style.display=!o&&l.percent?``:`none`}if(Te&&(Te.textContent=`Mã SP: ${z?.sku||n.id}`),!e?.skipImageChange){let e=z?.image||``;if(!e&&z?.id){let t=S.find(e=>e.variantId&&e.variantId===z.id);t&&(e=t.url)}if(!e&&w)for(let[t,n]of Object.entries(D)){let r=S.find(e=>!e.isGeneral&&e.attributeKey===t&&e.attributeValue===n);if(r){e=r.url;break}}if(!e&&S.length>0&&(e=S[0].url),e){let t=S.findIndex(t=>t.url===e);t===-1?(M&&(M.src=e),P&&(P.src=e)):I(t,{syncVariant:!1,scrollThumb:!0})}}let d=w?(n.variants||[]).every(e=>Number(e.stock)<=0):r<=0;if(r>0){if(U&&(U.className=`pdp-stock-status in-stock`),W&&(W.textContent=`Tình trạng: Còn hàng (${r} sản phẩm sẵn sàng giao)`),G&&(G.style.display=`none`),q&&(q.disabled=!1),J&&(J.disabled=!1),Y&&(Y.disabled=!1),X&&(X.disabled=!1),B){B.disabled=!1,B.max=r;let e=parseInt(B.value)||1;e>r&&(e=r),e<1&&(e=1),B.value=e,Z(e,r)}K&&(K.textContent=`(Tối đa: ${r} chiếc)`)}else if(U&&(U.className=`pdp-stock-status out-of-stock`),q&&(q.disabled=!0),J&&(J.disabled=!0),Y&&(Y.disabled=!0),X&&(X.disabled=!0),B&&(B.disabled=!0,B.value=1,B.max=0,Z(1,0)),!w)W&&(W.textContent=`Tình trạng: Tạm hết hàng (0 sản phẩm sẵn sàng giao)`),K&&(K.textContent=`(Tạm hết hàng)`),G&&(G.style.display=`block`,G.innerHTML=`<span style="display:inline-flex; align-items:center; gap:6px; vertical-align:middle; margin-right:4px;">${h(`alert-triangle`,{size:16,strokeWidth:1.8})}</span> Mẫu này hiện đã hết hàng. Quý khách vui lòng quay lại sau hoặc liên hệ hỗ trợ.`);else if(d)W&&(W.textContent=`Tình trạng: Tạm hết hàng (Tất cả phiên bản hiện đã hết hàng)`),K&&(K.textContent=`(Tạm hết hàng)`),G&&(G.style.display=`block`,G.innerHTML=`<span style="display:inline-flex; align-items:center; gap:6px; vertical-align:middle; margin-right:4px;">${h(`alert-triangle`,{size:16,strokeWidth:1.8})}</span> Tất cả các phiên bản của sản phẩm này hiện đã tạm hết hàng. Quý khách vui lòng quay lại sau.`);else if(o)W&&(W.textContent=`Tình trạng: Lựa chọn không khả dụng`),K&&(K.textContent=`(Không khả dụng)`),G&&(G.style.display=`block`,G.innerHTML=`<span style="display:inline-flex; align-items:center; gap:6px; vertical-align:middle; margin-right:4px;">${h(`alert-triangle`,{size:16,strokeWidth:1.8})}</span> Tổ hợp lựa chọn này không tồn tại trong danh mục sản phẩm. Quý khách vui lòng chọn lại thuộc tính khác.`);else if(W&&(W.textContent=`Tình trạng: Tạm hết hàng (0 sản phẩm sẵn sàng giao)`),K&&(K.textContent=`(Tạm hết hàng)`),G){G.style.display=`block`;let e=c||Object.values(D).join(` - `);G.innerHTML=`<span style="display:inline-flex; align-items:center; gap:6px; vertical-align:middle; margin-right:4px;">${h(`alert-triangle`,{size:16,strokeWidth:1.8})}</span> Lựa chọn "<strong>${u(e)}</strong>" hiện đã tạm hết hàng (tồn kho: 0). Quý khách vui lòng chọn màu sắc hoặc phiên bản khác còn hàng.`}w&&C.forEach(e=>{let t=document.getElementById(`selectedLabel_${e.name}`);t&&(t.textContent=D[e.name]||``),document.querySelectorAll(`.pdp-opt-btn[data-attr="${e.name}"]`).forEach(t=>{let r=t.getAttribute(`data-val`),i=r===D[e.name];t.classList.toggle(`is-selected`,i);let a={...D,[e.name]:r},o=(n.variants||[]).find(e=>e.options&&Object.entries(a).every(([t,n])=>e.options[t]===n)),s=!!o,c=s?Number(o.stock)<=0:!1,l=!s;t.classList.toggle(`is-sold-out`,s&&c),t.classList.toggle(`is-invalid-combo`,l);let u=t.querySelector(`.opt-out-tag`),d=t.querySelector(`.opt-invalid-tag`);s&&c?(d&&d.remove(),u||(u=document.createElement(`span`),u.className=`opt-out-tag`,t.appendChild(u)),u.innerHTML=`<span style="display:inline-flex; align-items:center; gap:3px;">${h(`x`,{size:11,strokeWidth:2})} Hết hàng</span>`):l?(u&&u.remove(),d||(d=document.createElement(`span`),d.className=`opt-invalid-tag`,d.textContent=`Không có mẫu này`,t.appendChild(d))):(u&&u.remove(),d&&d.remove())})})};w&&document.querySelectorAll(`.pdp-opt-btn[data-attr]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.getAttribute(`data-attr`),n=e.getAttribute(`data-val`);if(D[t]===n){let e=M?.getAttribute(`src`)||``;if(!z?.image||e===z.image)return}D[t]=n,Q({skipImageChange:!1})})}),Q({skipImageChange:!E}),V&&B&&V.addEventListener(`click`,()=>{let e=z?Math.max(0,Number(z.stock)||0):Math.max(0,Number(t.stock)||0),n=parseInt(B.value)||1;n>1&&(--n,B.value=n,Z(n,e))}),H&&B&&H.addEventListener(`click`,()=>{let e=z?Math.max(0,Number(z.stock)||0):Math.max(0,Number(t.stock)||0),n=parseInt(B.value)||1;n<e&&(n+=1,B.value=n,Z(n,e))}),B&&B.addEventListener(`change`,()=>{let e=z?Math.max(0,Number(z.stock)||0):Math.max(0,Number(t.stock)||0),n=parseInt(B.value)||1;n<1&&(n=1),n>e&&e>0&&(n=e),B.value=n,Z(n,e)});let $=(e=!1)=>{let r=s().find(e=>String(e.id)===String(t.id))||t,i=null,a=0,l=r.name;if(w){if(i=(r.variants||[]).find(e=>e.options?Object.entries(D).every(([t,n])=>e.options[t]===n):!1)||null,!i){p(`Tổ hợp lựa chọn này không tồn tại trong hệ thống. Quý khách vui lòng chọn lại.`),Q();return}a=Math.max(0,Number(i.stock)||0),l=`${r.name} (${i.name})`}else a=Math.max(0,Number(r.stock)||0);if(a<=0){p(`Phiên bản "${l}" hiện đã tạm hết hàng. Quý khách vui lòng chọn phiên bản khác.`),Q();return}let u=parseInt(B?.value)||1;if(u>a)p(`Tồn kho vừa cập nhật: "${l}" chỉ còn ${a} chiếc. Đã điều chỉnh số lượng phù hợp.`),B&&(B.value=a),Q();else try{w&&i?(d(r.id,u,i.id,i.options,i.name,c.price,i.image||r.image),p(`Đã thêm ${u} sản phẩm "${l}" vào giỏ hàng!`)):(d(r.id,u),p(`Đã thêm ${u} sản phẩm "${r.name}" vào giỏ hàng!`)),o(`#cartCount`).textContent=n(),window.dispatchEvent(new CustomEvent(`ecodesk-cart-updated`)),e&&setTimeout(()=>{window.location.href=`./checkout.html`},250)}catch(e){p(e.message||`Không thể thêm vào giỏ hàng.`),Q()}};o(`#addToCartBtn`).addEventListener(`click`,()=>$(!1)),o(`#buyNowBtn`).addEventListener(`click`,()=>$(!0)),o(`#mobileAddCartBtn`).addEventListener(`click`,()=>$(!1)),o(`#mobileBuyNowBtn`).addEventListener(`click`,()=>$(!0)),document.querySelectorAll(`.pdp-addon-add-btn[data-id]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.getAttribute(`data-id`),r=e.getAttribute(`data-name`);try{d(t,1)}catch(e){p(e.message||`Không thể thêm phụ kiện vào giỏ hàng.`);return}o(`#cartCount`).textContent=n();let i=e.innerHTML;e.innerHTML=`
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Đã thêm</span>
      `,e.classList.add(`is-added`),p(`Đã thêm "${r}" vào giỏ hàng!`),window.dispatchEvent(new CustomEvent(`ecodesk-cart-updated`)),setTimeout(()=>{e.innerHTML=i,e.classList.remove(`is-added`)},2e3)})}),w&&document.querySelectorAll(`.pdp-matrix-pick-btn[data-pick-variant-id]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.getAttribute(`data-pick-variant-id`),n=b.find(e=>String(e.id)===String(t));n&&(n.options&&typeof n.options==`object`&&Object.assign(D,n.options),Q({skipImageChange:!1}),o(`#pdpVariantsContainer`)?.scrollIntoView({behavior:`smooth`,block:`center`}))})}),document.querySelectorAll(`.pdp-tab-btn`).forEach(e=>{e.addEventListener(`click`,()=>{document.querySelectorAll(`.pdp-tab-btn`).forEach(e=>{e.classList.remove(`is-active`),e.setAttribute(`aria-selected`,`false`)}),document.querySelectorAll(`.pdp-tab-panel`).forEach(e=>e.classList.remove(`is-active`)),e.classList.add(`is-active`),e.setAttribute(`aria-selected`,`true`);let t=e.getAttribute(`data-tab`),n=document.getElementById(t);n&&n.classList.add(`is-active`)})}),document.querySelectorAll(`.pdp-faq-question`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.closest(`.pdp-faq-item`),n=t.classList.contains(`is-open`);document.querySelectorAll(`.pdp-faq-item`).forEach(e=>e.classList.remove(`is-open`)),n||t.classList.add(`is-open`)})}),pe(t)}function D(e){if(!e||!e.content)return``;let t=w(e.updatedAt||e.createdAt),n=e.updatedAt?` <span class="pdp-reply-edited">(đã chỉnh sửa)</span>`:``;return`
    <div class="pdp-admin-reply-box">
      <div class="pdp-admin-reply-head">
        <span class="pdp-admin-reply-badge">
          ${h(`shield-check`,{size:13,strokeWidth:2.2})}
          EcoDesk phản hồi
        </span>
        <span class="pdp-admin-reply-meta">${u(e.adminName||`Quản trị viên EcoDesk`)} · ${u(t)}${n}</span>
      </div>
      <p class="pdp-admin-reply-text">${u(e.content)}</p>
    </div>
  `}function O(e,t){let n=e.parentCommentId?t.find(t=>String(t.id)===String(e.parentCommentId)):null,r=e.authorRole===`admin`||e.authorRole===`staff`?`<span class="pdp-role-tag is-staff">EcoDesk</span>`:e.isGuest?`<span class="pdp-role-tag is-guest">Khách ghé thăm</span>`:``;return`
    <div class="pdp-comment-item ${n?`is-reply`:``}" data-comment-id="${u(e.id)}">
      <div class="pdp-comment-top">
        <div class="pdp-comment-author-wrap">
          <span class="pdp-comment-avatar">
            ${e.authorAvatar?`<img src="${u(e.authorAvatar)}" alt="Avatar">`:u(T(e.authorName))}
          </span>
          <strong class="pdp-comment-author">${u(e.authorName)}</strong>
          ${r}
          ${n?`<span class="pdp-reply-to-tag">trả lời @${u(n.authorName)}</span>`:``}
        </div>
        <div class="pdp-comment-actions-meta">
          <span class="pdp-comment-date">${u(w(e.createdAt))}</span>
          <button type="button" class="pdp-comment-reply-btn" data-reply-review="${u(e.reviewId)}" data-reply-comment="${u(e.id)}" data-reply-author="${u(e.authorName)}">Trả lời</button>
        </div>
      </div>
      <p class="pdp-comment-body">${u(e.content)}</p>
      ${D(e.adminReply)}
    </div>
  `}function de(e,t,n){let r=l(`./login.html`,{next:`${window.location.pathname}${window.location.search}#reviewsSection`});if(!n.canReview){let e=``;return n.reason===`not_logged_in`?e=`<a href="${r}" class="pdp-eligibility-btn">Đăng nhập để đánh giá</a>`:n.reason===`order_not_completed`?e=`<a href="./customer-orders.html" class="pdp-eligibility-btn is-secondary">Theo dõi đơn hàng của tôi</a>`:n.reason===`already_reviewed`&&(e=`<a href="./account.html" class="pdp-eligibility-btn is-secondary">Xem đánh giá trong Tài khoản</a>`),`
      <div class="pdp-review-eligibility-card is-${u(n.reason)}">
        <div class="pdp-eligibility-icon">
          ${h(n.reason===`already_reviewed`?`check-circle-2`:`lock`,{size:18,strokeWidth:2})}
        </div>
        <div class="pdp-eligibility-body">
          <strong>${n.reason===`already_reviewed`?`Bạn đã hoàn thành đánh giá cho đơn hàng của mình`:`Chưa đủ điều kiện gửi đánh giá sao`}</strong>
          <p>${u(n.message)}</p>
          <p class="pdp-eligibility-subnote">Bạn vẫn có thể trao đổi và bình luận bên dưới các đánh giá hiện có mà không cần mua hàng trước.</p>
          ${e?`<div class="pdp-eligibility-actions">${e}</div>`:``}
        </div>
      </div>
    `}return`
    <form class="pdp-add-review-form" id="newReviewForm" novalidate>
      <div class="pdp-form-header-row">
        <h4 class="pdp-form-title">Viết đánh giá của bạn</h4>
        ${n.unreviewedOrders.length>1?`
      <label class="pdp-order-select-wrap">
        <span>Chọn đơn hàng hoàn tất:</span>
        <select id="reviewOrderSelect" class="pdp-order-select">
          ${n.unreviewedOrders.map(e=>`<option value="${u(e.id)}">#${u(e.id)} · ${u(w(e.createdAt))}</option>`).join(``)}
        </select>
      </label>
    `:`<span class="pdp-verified-order-pill">${h(`check-circle-2`,{size:13,strokeWidth:2.2})} Đơn hàng hoàn tất #${u(n.eligibleOrder.id)}</span>`}
      </div>
      <div class="pdp-auto-identity-bar">
        <span class="pdp-identity-avatar">
          ${t?.avatar?`<img src="${u(t.avatar)}" alt="Avatar">`:u(T(t?.name||t?.email||`K`))}
        </span>
        <div>
          <span class="pdp-identity-label">Đánh giá tự động bằng tài khoản:</span>
          <strong class="pdp-identity-name">${u(t?.name||t?.email||`Khách hàng EcoDesk`)}</strong>
        </div>
      </div>
      <div class="pdp-rating-select-group">
        <span style="font-size: 0.88rem; font-weight: 700; color: #334155;">Mức độ hài lòng:</span>
        <div id="starPicker" role="radiogroup" aria-label="Chọn số sao">
          ${[1,2,3,4,5].map(e=>`
            <button type="button" class="pdp-star-input-btn is-active" data-star="${e}" aria-label="${e} sao">★</button>
          `).join(``)}
        </div>
        <span id="starRatingLabel" class="pdp-star-text-label">5/5 - Rất hài lòng</span>
      </div>
      <textarea id="reviewTextInput" class="pdp-textarea" maxlength="1000" placeholder="Chia sẻ trải nghiệm thực tế về chất lượng sản phẩm, độ hoàn thiện và dịch vụ giao hàng của EcoDesk (tối thiểu 5 ký tự)..." required></textarea>
      <div class="pdp-textarea-meta">
        <span class="pdp-char-counter" id="reviewCharCounter">0 / 1000</span>
      </div>
      <div class="pdp-form-feedback" id="reviewFormFeedback" role="alert" hidden></div>
      <div class="pdp-form-actions">
        <button type="submit" class="pdp-submit-review-btn" id="submitReviewBtn">Gửi đánh giá</button>
      </div>
    </form>
  `}function fe(e,{successMessage:t=``}={}){let n=i(),r=re(e.id),a=ae(e.id),o=C(e.id,n),s=l(`./login.html`,{next:`${window.location.pathname}${window.location.search}#reviewsSection`}),c=n?`Bình luận với tên: <strong>${u(n.name||n.email)}</strong>`:`Bình luận dưới tên <strong>Khách ghé thăm</strong> · <a href="${s}">Đăng nhập</a>`;return`
    <h3 class="pdp-section-title">
      ${h(`message-square`,{size:20,strokeWidth:2})}
      Đánh giá &amp; Bình luận sản phẩm
    </h3>

    <div class="pdp-rating-overview">
      <div class="pdp-overview-score-col">
        ${r.count>0?`
            <div class="pdp-big-score">${r.average.toFixed(1)}</div>
            <span class="pdp-stars">${y(r.average)}</span>
            <p class="pdp-score-sub"><strong>${r.count}</strong> đánh giá · <strong>${e.sold}</strong> đã bán</p>
          `:`
            <div class="pdp-big-score pdp-big-score-empty" style="font-size: 1.15rem; font-weight: 800; color: #475569; margin-bottom: 4px;">Chưa có đánh giá</div>
            <p class="pdp-score-sub"><strong>${e.sold}</strong> đã bán</p>
          `}
      </div>
      <div class="pdp-rating-bars">
        ${[5,4,3,2,1].map(e=>{let t=r.distribution[e]||0;return`
            <div class="pdp-bar-row">
              <span class="pdp-bar-label">${e} ★</span>
              <div class="pdp-bar-track"><div class="pdp-bar-fill" style="width: ${r.count>0?Math.round(t/r.count*100):0}%;"></div></div>
              <span class="pdp-bar-count">${t}</span>
            </div>
          `}).join(``)}
      </div>
    </div>

    <section class="pdp-review-composer-section" aria-label="Biểu mẫu gửi đánh giá">
      ${de(e,n,o)}
      ${t?`<div class="pdp-form-feedback is-success pdp-review-success-banner" role="status">${u(t)}</div>`:``}
    </section>

    <section class="pdp-reviews-list-section" aria-label="Danh sách đánh giá sản phẩm">
      <div class="pdp-reviews-list" id="reviewsContainer">
      ${a.length===0?`
            <div class="pdp-reviews-empty">
              <div class="pdp-reviews-empty-icon">${h(`star`,{size:32,strokeWidth:1.6})}</div>
              <h4>Chưa có đánh giá nào cho sản phẩm này</h4>
              <p>Đánh giá đầu tiên từ khách hàng đã nhận hàng thành công sẽ xuất hiện tại đây.</p>
            </div>
          `:a.map(e=>`
            <article class="pdp-review-card" data-review-id="${u(e.id)}">
              <div class="pdp-review-header">
                <div class="pdp-reviewer-meta">
                  <span class="pdp-reviewer-avatar">
                    ${e.authorAvatar?`<img src="${u(e.authorAvatar)}" alt="Avatar">`:u(T(e.authorName))}
                  </span>
                  <div>
                    <div class="pdp-reviewer-name-row">
                      <span class="pdp-reviewer-name">${u(e.authorName)}</span>
                      ${e.verifiedPurchase?`<span class="pdp-verified-badge">${h(`check-circle-2`,{size:12,strokeWidth:2.3})} Đã mua hàng</span>`:``}
                    </div>
                    <div class="pdp-stars" style="font-size: 0.85rem; margin-top: 2px;">${y(e.rating)}</div>
                  </div>
                </div>
                <span class="pdp-review-date">${u(w(e.createdAt||e.date))}</span>
              </div>

              <p class="pdp-review-comment">${u(e.comment)}</p>

              ${D(e.adminReply)}

              <div class="pdp-review-comments-wrap">
                <div class="pdp-comments-toolbar">
                  <button type="button" class="pdp-toggle-comments-btn" data-toggle-comment-form="${u(e.id)}">
                    ${h(`message-circle`,{size:14,strokeWidth:2})}
                    Bình luận (${(e.comments||[]).length})
                  </button>
                </div>

                ${(e.comments||[]).length>0?`<div class="pdp-comments-list">${e.comments.map(t=>O(t,e.comments)).join(``)}</div>`:``}

                <form class="pdp-comment-form" data-review-comment-form="${u(e.id)}" hidden novalidate>
                  <div class="pdp-comment-identity-hint">${c}</div>
                  <div class="pdp-comment-reply-target" data-reply-target-banner hidden>
                    <span>Đang trả lời <strong data-reply-target-name></strong></span>
                    <button type="button" class="pdp-clear-reply-target" title="Hủy trả lời">&times;</button>
                  </div>
                  <input type="hidden" name="parentCommentId" value="">
                  <div class="pdp-comment-input-row">
                    <textarea class="pdp-comment-input" name="content" maxlength="600" placeholder="Viết bình luận hoặc câu hỏi về đánh giá này..." required></textarea>
                    <button type="submit" class="pdp-comment-submit-btn">Gửi</button>
                  </div>
                  <div class="pdp-form-feedback" data-comment-feedback role="alert" hidden></div>
                </form>
              </div>
            </article>
          `).join(``)}
      </div>
    </section>
  `}function k(e){let t=re(e.id),n=document.getElementById(`pdpTopRatingStars`),r=document.getElementById(`pdpTopRatingScore`),i=document.getElementById(`jumpToReviewsLink`);n&&(n.hidden=t.count<=0,n.innerHTML=t.count>0?y(t.average):``,n.setAttribute(`aria-label`,t.count>0?`${t.average.toFixed(1)} sao`:`Chưa có đánh giá`)),r&&(r.textContent=t.count>0?`${t.average.toFixed(1)} / 5`:`Chưa có đánh giá`),i&&(i.hidden=t.count<=0,i.textContent=t.count>0?`(${t.count} đánh giá)`:``)}function pe(e){let t=document.getElementById(`pdpReviewsCard`);if(!t)return;let n=!1,r=5,i={1:`1/5 - Rất không hài lòng`,2:`2/5 - Không hài lòng`,3:`3/5 - Bình thường`,4:`4/5 - Hài lòng`,5:`5/5 - Rất hài lòng`};function a(){_(t),t.querySelectorAll(`.pdp-star-input-btn`).forEach(e=>{e.addEventListener(`click`,()=>{r=parseInt(e.getAttribute(`data-star`),10)||5,t.querySelectorAll(`.pdp-star-input-btn`).forEach(e=>{let t=parseInt(e.getAttribute(`data-star`),10)||5;e.classList.toggle(`is-active`,t<=r)});let n=t.querySelector(`#starRatingLabel`);n&&(n.textContent=i[r]||``)})});let a=t.querySelector(`#reviewTextInput`),s=t.querySelector(`#reviewCharCounter`);a&&s&&a.addEventListener(`input`,()=>{s.textContent=`${a.value.length} / 1000`});let c=t.querySelector(`#newReviewForm`);c&&c.addEventListener(`submit`,async i=>{if(i.preventDefault(),n)return;let s=t.querySelector(`#reviewFormFeedback`),c=t.querySelector(`#submitReviewBtn`),l=t.querySelector(`#reviewOrderSelect`),u=a?a.value.trim():``,d=(e,t=`error`)=>{s&&(s.textContent=e,s.className=`pdp-form-feedback is-${t}`,s.hidden=!e)};d(``),n=!0,c&&(c.disabled=!0,c.textContent=`Đang gửi đánh giá...`);try{await x({productId:e.id,rating:r,comment:u,orderId:l?l.value:null}),r=5,o(null,`Cảm ơn bạn! Đánh giá của bạn đã được đăng thành công.`),p(`Cảm ơn bạn! Đánh giá của bạn đã được đăng thành công.`)}catch(e){d(e.message||`Không thể gửi đánh giá lúc này.`,`error`)}finally{n=!1,c&&c.isConnected&&(c.disabled=!1,c.textContent=`Gửi đánh giá`)}}),t.querySelectorAll(`[data-toggle-comment-form]`).forEach(e=>{e.addEventListener(`click`,()=>{let n=e.getAttribute(`data-toggle-comment-form`),r=t.querySelector(`[data-review-comment-form="${n}"]`);r&&(r.hidden=!r.hidden,r.hidden||r.querySelector(`textarea`)?.focus())})}),t.querySelectorAll(`.pdp-comment-reply-btn`).forEach(e=>{e.addEventListener(`click`,()=>{let n=e.getAttribute(`data-reply-review`),r=e.getAttribute(`data-reply-comment`),i=e.getAttribute(`data-reply-author`),a=t.querySelector(`[data-review-comment-form="${n}"]`);if(!a)return;a.hidden=!1;let o=a.querySelector(`input[name="parentCommentId"]`),s=a.querySelector(`[data-reply-target-banner]`),c=a.querySelector(`[data-reply-target-name]`);o&&(o.value=r||``),c&&(c.textContent=i||`bình luận`),s&&(s.hidden=!1),a.querySelector(`textarea`)?.focus()})}),t.querySelectorAll(`.pdp-clear-reply-target`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.closest(`[data-review-comment-form]`);if(!t)return;let n=t.querySelector(`input[name="parentCommentId"]`),r=t.querySelector(`[data-reply-target-banner]`);n&&(n.value=``),r&&(r.hidden=!0)})}),t.querySelectorAll(`[data-review-comment-form]`).forEach(t=>{let n=!1;t.addEventListener(`submit`,async r=>{if(r.preventDefault(),n)return;let i=t.getAttribute(`data-review-comment-form`),a=t.querySelector(`textarea[name="content"]`),s=t.querySelector(`input[name="parentCommentId"]`),c=t.querySelector(`button[type="submit"]`),l=t.querySelector(`[data-comment-feedback]`),u=(e,t=`error`)=>{l&&(l.textContent=e,l.className=`pdp-form-feedback is-${t}`,l.hidden=!e)};u(``),n=!0,c&&(c.disabled=!0,c.textContent=`Đang gửi...`);try{await b({productId:e.id,reviewId:i,content:a?a.value:``,parentCommentId:s&&s.value?s.value:null}),o(i),p(`Bình luận của bạn đã được hiển thị.`)}catch(e){u(e.message||`Không thể gửi bình luận.`,`error`)}finally{n=!1,c&&c.isConnected&&(c.disabled=!1,c.textContent=`Gửi`)}})})}function o(n=null,r=``){if(t.innerHTML=fe(e,{successMessage:r}),k(e),a(),n){let e=t.querySelector(`[data-review-comment-form="${n}"]`);e&&(e.hidden=!1)}}a(),window.__ecodeskDetailReviewSyncBound||(window.__ecodeskDetailReviewSyncBound=!0,window.addEventListener(`storage`,e=>{(e.key===`ecodesk_customer_reviews`||e.key===`ecodesk_orders`||e.key===`ecodesk_current_user`)&&o()}),window.addEventListener(S,()=>{k(e)}))}async function A(){try{await c();try{await ie()}catch{}let e=ee(`id`)||`P002`,i=t(e),a=o(`#cartCount`);if(a&&(a.textContent=n()),!i){let t=o(`#detailRoot`);t&&(t.innerHTML=`
          <div class="empty" style="text-align: center; padding: 60px 20px;">
            <h2 style="font-size: 1.4rem; color: #1e293b; margin-bottom: 8px;">Không tìm thấy sản phẩm</h2>
            <p style="color: #64748b; margin-bottom: 20px;">Sản phẩm bạn đang tìm kiếm (mã: <strong>${u(e)}</strong>) không tồn tại hoặc đã ngừng kinh doanh.</p>
            <a class="btn" href="./products.html">Xem tất cả sản phẩm EcoDesk</a>
          </div>
        `);return}document.title=`${i.name||`Sản phẩm`} - EcoDesk`,E(i,r()),requestAnimationFrame(()=>ne())}catch(e){console.error(`Lỗi khi dựng trang chi tiết sản phẩm:`,e);let t=o(`#detailRoot`);t&&(t.innerHTML=`
        <div class="empty" style="text-align: center; padding: 60px 20px;">
          <h2 style="font-size: 1.4rem; color: #dc2626; margin-bottom: 8px;">Đã xảy ra lỗi khi tải dữ liệu</h2>
          <p style="color: #64748b; margin-bottom: 20px;">Hệ thống đang đồng bộ kho hàng. Quý khách vui lòng bấm nút bên dưới để tải lại hoặc xem danh mục sản phẩm.</p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button class="btn" onclick="window.location.reload()">Tải lại trang</button>
            <a class="btn btn-outline" href="./products.html">Danh mục sản phẩm</a>
          </div>
        </div>
      `)}}A();