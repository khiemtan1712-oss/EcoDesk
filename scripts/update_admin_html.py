with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update action buttons
old_btn = '''              <a class="btn-admin primary" href="./add.html" style="text-decoration: none;">
                <span>+</span>
                <span>Thêm có biến thể</span>
              </a>
              <button class="btn-admin secondary" id="openAddProductModalBtn" type="button">
                <span><i data-lucide="zap" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i></span>
                <span>Thêm nhanh</span>
              </button>'''

new_btn = '''              <button class="btn-admin primary" id="openAddProductModalBtn" type="button">
                <span>+</span>
                <span>Thêm sản phẩm</span>
              </button>'''

if old_btn in content:
    content = content.replace(old_btn, new_btn, 1)
    print('Updated action buttons.')
else:
    print('Warning: old_btn not found exactly.')

# 2. Update Product Modal
old_modal_start = '  <!-- ==================== PRODUCT MODAL (THÊM SẢN PHẨM) ==================== -->'
old_modal_end = '  <!-- ==================== DELETE PRODUCT CONFIRMATION MODAL ==================== -->'

new_modal = '''  <!-- ==================== PRODUCT MODAL (THÊM & SỬA SẢN PHẨM) ==================== -->
  <div class="admin-modal-backdrop" id="productModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="productModalTitle">
    <div class="product-modal-card">
      <div class="product-modal-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <h3 id="productModalTitle" style="margin: 0; font-size: 17px; font-weight: 700; color: #0f172a;">Thêm sản phẩm</h3>
          <span id="productModalModeBadge" style="font-size: 11.5px; font-weight: 600; padding: 2px 8px; border-radius: 999px; border: 1px solid #86efac; background: #dcfce7; color: #15803d;">Thêm mới</span>
        </div>
        <button class="admin-modal-close" id="productModalCloseBtn" type="button" aria-label="Đóng" style="font-size: 22px; line-height: 1; border: none; background: transparent; cursor: pointer; color: #64748b;">&times;</button>
      </div>
      <form id="productModalForm" novalidate style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; margin: 0;">
        <div class="product-modal-body" id="productModalBody">
          <!-- Biểu mẫu do js/admin-product-modal.js render -->
        </div>
        <div class="product-modal-footer">
          <button class="btn-admin secondary" id="productModalCancelBtn" type="button">Hủy</button>
          <button class="btn-admin secondary" id="productModalSaveAndPoBtn" type="button" style="background: #0284c7; color: #ffffff; border-color: #0284c7; display: inline-flex; align-items: center; gap: 6px;">
            <span><i data-lucide="plus-circle" style="width:14px; height:14px;"></i></span>
            <span>Lưu &amp; tạo phiếu nhập đầu tiên</span>
          </button>
          <button class="btn-admin primary" id="productModalSaveBtn" type="submit" style="display: inline-flex; align-items: center; gap: 6px;">
            <span><i data-lucide="check" style="width:14px; height:14px;"></i></span>
            <span id="productModalSaveText">Lưu sản phẩm</span>
          </button>
        </div>
      </form>
    </div>
  </div>\n\n'''

if old_modal_start in content and old_modal_end in content:
    idx1 = content.find(old_modal_start)
    idx2 = content.find(old_modal_end)
    content = content[:idx1] + new_modal + content[idx2:]
    print('Updated product modal markup.')
else:
    print('Warning: old modal markers not found.')

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Saved admin.html.')

