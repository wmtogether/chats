import { useState, useEffect, useRef } from 'react';
import { X, Palette, Loader2, Upload, Save, Ruler } from 'lucide-react';
import { useToast } from '../Library/hooks/useToast';
import { getNullStringValue } from '../Library/utils/api';
import { apiClient } from '../Library/Authentication/AuthContext';
import DropdownMenu from './ui/DropdownMenu';

interface NewDesignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (designData: any) => void;
  currentChat?: any;
}

interface FormData {
  jobName: string;
  dimensionsWidth: string;
  dimensionsHeight: string;
  dimensionsDepth: string;
  dimensionUnit: string;
  customerName: string;
  customerId: string;
  note: string;
  initialComment: string;
  editCount: string;
  quantity: string;
  showWatermark: boolean;
  showLogo: boolean;
}

export default function NewDesignDialog({ isOpen, onClose, onSuccess, currentChat }: NewDesignDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [imageDragOver, setImageDragOver] = useState(false);
  const [fileDragOver, setFileDragOver] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<FormData>({
    jobName: '',
    dimensionsWidth: '',
    dimensionsHeight: '',
    dimensionsDepth: '',
    dimensionUnit: 'cm',
    customerName: '',
    customerId: '',
    note: '',
    initialComment: '',
    editCount: '0',
    quantity: '',
    showWatermark: true,
    showLogo: true,
  });
  const { addToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      const customerName = currentChat ? getNullStringValue(currentChat.customers) : '';
      const customerId = currentChat ? getNullStringValue(currentChat.customerId) : '';
      
      setFormData({
        jobName: '',
        dimensionsWidth: '',
        dimensionsHeight: '',
        dimensionsDepth: '',
        dimensionUnit: 'cm',
        customerName: customerName || '',
        customerId: customerId || '',
        note: '',
        initialComment: '',
        editCount: '0',
        quantity: '',
        showWatermark: true,
        showLogo: true,
      });
      setUploadedImage(null);
      setUploadedFilePath(null);
      setUploadedFileName(null);
    }
  }, [isOpen, currentChat]);

  const uploadImage = async (file: File) => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      addToast({ message: 'ไฟล์รูปภาพใหญ่เกินไป (สูงสุด 50MB)', type: 'error' });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      addToast({ message: 'กรุณาเลือกไฟล์รูปภาพ', type: 'error' });
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await apiClient.post('/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data?.success && response.data?.imagePath) {
        setUploadedImage(response.data.imagePath);
        addToast({ message: 'อัปโหลดรูปภาพสำเร็จ', type: 'success' });
      }
    } catch (error) {
      console.error('Image upload error:', error);
      addToast({ message: 'อัปโหลดรูปภาพล้มเหลว', type: 'error' });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const uploadFile = async (file: File) => {
    const maxSize = 3072 * 1024 * 1024; // 3GB
    if (file.size > maxSize) {
      addToast({ message: 'ไฟล์ใหญ่เกินไป (สูงสุด 3GB)', type: 'error' });
      return;
    }

    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post('/fileupload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data?.success) {
        const filePath = response.data.url || response.data.filePath || file.name;
        setUploadedFilePath(filePath);
        setUploadedFileName(response.data.originalName || file.name);
        addToast({ message: 'อัปโหลดไฟล์สำเร็จ', type: 'success' });
      }
    } catch (error) {
      console.error('File upload error:', error);
      addToast({ message: 'อัปโหลดไฟล์ล้มเหลว', type: 'error' });
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.jobName.trim()) {
      addToast({ message: 'กรุณากรอกชื่องาน', type: 'error' });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiClient.post('/designs', {
        jobName: formData.jobName.trim(),
        customerName: formData.customerName.trim() || null,
        customerId: formData.customerId.trim() || null,
        quantity: formData.quantity ? parseInt(formData.quantity) : null,
        designData: {
          jobName: formData.jobName.trim(),
          dimensionsWidth: formData.dimensionsWidth || null,
          dimensionsHeight: formData.dimensionsHeight || null,
          dimensionsDepth: formData.dimensionsDepth || null,
          dimensionUnit: formData.dimensionUnit || 'cm',
          customerName: formData.customerName.trim() || null,
          customerId: formData.customerId.trim() || null,
          note: formData.note.trim() || null,
          editCount: parseInt(formData.editCount) || 0,
          comments: formData.initialComment.trim() ? [{
            id: Date.now().toString(),
            message: formData.initialComment.trim(),
            createdBy: 'Current User',
            createdByRole: 'user',
            createdAt: new Date().toISOString(),
          }] : [],
          image: uploadedImage,
          designFile: uploadedFilePath,
          designFilePath: uploadedFilePath,
          designFileOriginalName: uploadedFileName,
          showWatermark: formData.showWatermark,
          showLogo: formData.showLogo,
        },
      });
      
      addToast({ message: 'สร้างงานออกแบบสำเร็จ', type: 'success' });
      
      if (onSuccess && response.data?.data) {
        onSuccess(response.data.data);
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to create design:', error);
      addToast({ 
        message: error instanceof Error ? error.message : 'สร้างงานออกแบบล้มเหลว', 
        type: 'error' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-outline-variant rounded-3xl shadow-2xl w-full max-w-5xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            <h2 className="title-large text-on-surface">สร้างงานออกแบบ</h2>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="p-2 hover:bg-surface-variant rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block label-medium text-on-surface mb-2">
                  ชื่องาน <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={formData.jobName}
                  onChange={(e) => setFormData({ ...formData, jobName: e.target.value })}
                  placeholder="กรอกชื่องาน"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block label-medium text-on-surface mb-2">ขนาด (Dimensions)</label>
                <div className="grid grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={formData.dimensionsWidth}
                    onChange={(e) => setFormData({ ...formData, dimensionsWidth: e.target.value })}
                    placeholder="กว้าง"
                    disabled={isSubmitting}
                    className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <input
                    type="text"
                    value={formData.dimensionsHeight}
                    onChange={(e) => setFormData({ ...formData, dimensionsHeight: e.target.value })}
                    placeholder="สูง"
                    disabled={isSubmitting}
                    className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <input
                    type="text"
                    value={formData.dimensionsDepth}
                    onChange={(e) => setFormData({ ...formData, dimensionsDepth: e.target.value })}
                    placeholder="ลึก"
                    disabled={isSubmitting}
                    className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <DropdownMenu
                    value={formData.dimensionUnit}
                    onChange={(value) => setFormData({ ...formData, dimensionUnit: value })}
                    disabled={isSubmitting}
                    variant="filled"
                    items={[
                      { id: 'cm', label: 'cm', icon: <Ruler className="h-4 w-4" /> },
                      { id: 'm', label: 'm', icon: <Ruler className="h-4 w-4" /> },
                      { id: 'inch', label: 'inch', icon: <Ruler className="h-4 w-4" /> },
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block label-medium text-on-surface mb-2">ชื่อลูกค้า</label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="ชื่อลูกค้า"
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-on-surface"
                  />
                </div>
                <div>
                  <label className="block label-medium text-on-surface mb-2">รหัสลูกค้า</label>
                  <input
                    type="text"
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    placeholder="รหัสลูกค้า"
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-on-surface"
                  />
                </div>
              </div>

              <div>
                <label className="block label-medium text-on-surface mb-2">หมายเหตุ</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="หมายเหตุเพิ่มเติม"
                  disabled={isSubmitting}
                  rows={3}
                  className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-on-surface resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block label-medium text-on-surface mb-2">แก้ไขครั้งที่</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.editCount}
                    onChange={(e) => setFormData({ ...formData, editCount: e.target.value })}
                    placeholder="0"
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-on-surface"
                  />
                </div>
                <div>
                  <label className="block label-medium text-on-surface mb-2">จำนวน</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="จำนวน"
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-on-surface"
                  />
                </div>
              </div>

              <div>
                <label className="block label-medium text-on-surface mb-2">ความคิดเห็นเริ่มต้น</label>
                <textarea
                  value={formData.initialComment}
                  onChange={(e) => setFormData({ ...formData, initialComment: e.target.value })}
                  placeholder="ความคิดเห็นหรือรายละเอียดเพิ่มเติม"
                  disabled={isSubmitting}
                  rows={2}
                  className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-on-surface resize-none"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border border-outline-variant rounded-xl">
                  <div>
                    <p className="label-medium text-on-surface">แสดงลายน้ำ (Watermark)</p>
                    <p className="body-small text-on-surface-variant">แสดงข้อความ "SAMPLE" บน PDF</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showWatermark}
                      onChange={(e) => setFormData({ ...formData, showWatermark: e.target.checked })}
                      disabled={isSubmitting}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 border border-outline-variant rounded-xl">
                  <div>
                    <p className="label-medium text-on-surface">แสดงโลโก้ (Logo)</p>
                    <p className="body-small text-on-surface-variant">แสดงโลโก้บริษัทบน PDF</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showLogo}
                      onChange={(e) => setFormData({ ...formData, showLogo: e.target.checked })}
                      disabled={isSubmitting}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Right Column - File Uploads */}
            <div className="space-y-4">
              <div>
                <label className="block label-medium text-on-surface mb-2">รูปภาพอ้างอิง</label>
                {isUploadingImage ? (
                  <div className="border-2 border-dashed border-outline-variant rounded-xl p-6 text-center">
                    <Loader2 className="h-8 w-8 mx-auto mb-2 text-primary animate-spin" />
                    <p className="body-small text-on-surface-variant">กำลังอัปโหลดรูปภาพ...</p>
                  </div>
                ) : uploadedImage ? (
                  <div className="relative group">
                    <img
                      src={`/api/image/${uploadedImage}`}
                      alt="Uploaded"
                      className="w-full h-64 object-contain bg-surface-container rounded-xl border border-outline-variant"
                    />
                    <button
                      type="button"
                      onClick={() => setUploadedImage(null)}
                      className="absolute top-2 right-2 p-2 bg-error text-on-error rounded-full hover:bg-error/90"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                      imageDragOver ? 'border-primary bg-primary/10' : 'border-outline-variant'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setImageDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setImageDragOver(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setImageDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) uploadImage(file);
                    }}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-on-surface-variant" />
                    <p className="body-medium text-on-surface mb-1">คลิกเพื่ออัปโหลดหรือลากไฟล์มาวาง</p>
                    <p className="body-small text-on-surface-variant">JPG, PNG, GIF, WebP (สูงสุด 50MB)</p>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadImage(file);
                      }}
                      disabled={isUploadingImage}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block label-medium text-on-surface mb-2">ไฟล์ออกแบบ (.ai, .psd, .pdf)</label>
                {isUploadingFile ? (
                  <div className="border-2 border-dashed border-outline-variant rounded-xl p-6 text-center">
                    <Loader2 className="h-8 w-8 mx-auto mb-2 text-primary animate-spin" />
                    <p className="body-small text-on-surface-variant">กำลังอัปโหลดไฟล์...</p>
                  </div>
                ) : uploadedFilePath ? (
                  <div className="border border-outline-variant rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="label-medium text-on-surface">ไฟล์ที่อัปโหลด</p>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedFilePath(null);
                          setUploadedFileName(null);
                        }}
                        className="p-1 hover:bg-surface-variant rounded-full"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="body-small text-on-surface-variant break-all">
                      {uploadedFileName || uploadedFilePath}
                    </p>
                  </div>
                ) : (
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                      fileDragOver ? 'border-primary bg-primary/10' : 'border-outline-variant'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setFileDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setFileDragOver(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setFileDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) uploadFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-on-surface-variant" />
                    <p className="body-medium text-on-surface mb-1">คลิกเพื่ออัปโหลดหรือลากไฟล์มาวาง</p>
                    <p className="body-small text-on-surface-variant">AI, PSD, PDF, EPS, SVG (สูงสุด 3GB)</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadFile(file);
                      }}
                      disabled={isUploadingFile}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 p-6 border-t border-outline-variant">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-3 bg-surface-variant text-on-surface rounded-xl hover:bg-surface-variant/80 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-primary text-on-primary rounded-xl hover:bg-primary/90 flex items-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังสร้าง...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  สร้างงานออกแบบ
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
