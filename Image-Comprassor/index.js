
    function debug(message) {
      console.log(`[ImageCompressor] ${message}`);
    }

    debug('Script loaded');

    const form = document.getElementById('imageCompressorForm');
    const compressBtn = document.getElementById('compressBtn');
    const resultContainer = document.getElementById('resultContainer');
    const imageResults = document.getElementById('imageResults');
    const loading = document.getElementById('loading');
    const fileUpload = document.getElementById('imageUpload');
    const fileUploadBtn = document.querySelector('.file-upload-btn');
    const fileList = document.getElementById('fileList');
    const summary = document.getElementById('summary');
    const totalOriginalSize = document.getElementById('totalOriginalSize');
    const totalCompressedSize = document.getElementById('totalCompressedSize');
    const overallReduction = document.getElementById('overallReduction');
    const downloadAllContainer = document.getElementById('downloadAllContainer');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValue = document.getElementById('qualityValue');

    let selectedFiles = [];
    let compressedFiles = [];

    qualitySlider.addEventListener('input', function() {
      qualityValue.textContent = `Quality: ${this.value}%`;
      updateSliderBackground(this);
    });

    function updateSliderBackground(slider) {
      const value = (slider.value - slider.min) / (slider.max - slider.min) * 100;
      slider.style.background = `linear-gradient(to right, var(--primary) 0%, var(--primary) ${value}%, var(--border-color) ${value}%, var(--border-color) 100%)`;
    }

    // Initialize slider background
    updateSliderBackground(qualitySlider);

    function formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function updateFileList() {
      fileList.innerHTML = '';
      selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
          <span class="file-name">${file.name}</span>
          <span class="file-size">${formatFileSize(file.size)}</span>
          <button class="remove-btn" data-index="${index}">Remove</button>
        `;
        fileList.appendChild(fileItem);
      });

      document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const index = parseInt(this.getAttribute('data-index'));
          selectedFiles.splice(index, 1);
          updateFileList();
          compressBtn.disabled = selectedFiles.length === 0;
        });
      });

      compressBtn.disabled = selectedFiles.length === 0;
    }

    fileUpload.addEventListener('change', function() {
      if (this.files && this.files.length > 0) {
        const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
        const newFiles = Array.from(this.files).filter(file => {
          if (!validTypes.includes(file.type)) {
            alert(`Unsupported file format: ${file.name}. Please upload PNG, JPG, WebP, or SVG.`);
            return false;
          }
          if (file.size > 10 * 1024 * 1024) {
            alert(`File size exceeds 10MB: ${file.name}. Please upload a smaller file.`);
            return false;
          }
          return true;
        });

        selectedFiles = [...selectedFiles, ...newFiles];
        updateFileList();
        this.value = '';
      }
    });

    fileUploadBtn.addEventListener('dragover', function(e) {
      e.preventDefault();
      this.classList.add('dragover');
    });

    fileUploadBtn.addEventListener('dragleave', function(e) {
      e.preventDefault();
      this.classList.remove('dragover');
    });

    fileUploadBtn.addEventListener('drop', function(e) {
      e.preventDefault();
      this.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
        const newFiles = Array.from(e.dataTransfer.files).filter(file => {
          if (!validTypes.includes(file.type)) {
            alert(`Unsupported file format: ${file.name}. Please upload PNG, JPG, WebP, or SVG.`);
            return false;
          }
          if (file.size > 10 * 1024 * 1024) {
            alert(`File size exceeds 10MB: ${file.name}. Please upload a smaller file.`);
            return false;
          }
          return true;
        });

        selectedFiles = [...selectedFiles, ...newFiles];
        updateFileList();
      }
    });

    async function compressRasterImage(file, qualityPercent) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = function(e) {
          img.src = e.target.result;
        };

        img.onload = async function() {
          let canvas = document.createElement('canvas');
          let ctx = canvas.getContext('2d');

          let width = img.width;
          let height = img.height;

          canvas.width = width;
          canvas.height = height;

          ctx.drawImage(img, 0, 0);

          let quality = qualityPercent / 100;
          let blob;

          blob = await new Promise((resolveBlob) => {
            canvas.toBlob(
              (b) => resolveBlob(b),
              file.type,
              quality
            );
          });

          const targetSizeBytes = file.size * 0.5;
          if (blob.size > targetSizeBytes) {
            let scaleFactor = Math.sqrt(targetSizeBytes / blob.size) * 0.95;
            width = Math.round(width * scaleFactor);
            height = Math.round(height * scaleFactor);

            canvas = document.createElement('canvas');
            ctx = canvas.getContext('2d');
            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);

            blob = await new Promise((resolveBlob) => {
              canvas.toBlob(
                (b) => resolveBlob(b),
                file.type,
                quality
              );
            });
          }

          if (blob) {
            resolve(new File([blob], file.name, { type: file.type }));
          } else {
            reject(new Error('Compression failed'));
          }
        };

        img.onerror = reject;
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    async function compressSvg(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function(e) {
          try {
            const svgText = e.target.result;
            const optimizedSvg = SVGO.optimize(svgText, {
              multipass: true,
              plugins: [
                'preset-default',
                'removeComments',
                'removeEmptyAttrs',
                'removeEmptyText'
              ]
            });

            const blob = new Blob([optimizedSvg.data], { type: 'image/svg+xml' });
            resolve(new File([blob], file.name, { type: 'image/svg+xml' }));
          } catch (err) {
            reject(err);
          }
        };

        reader.onerror = reject;
        reader.readAsText(file);
      });
    }

    async function compressSingleImage(file, index) {
      try {
        const originalSize = file.size;
        let compressedFile;

        const qualityPercent = parseInt(qualitySlider.value);

        if (file.type === 'image/svg+xml') {
          compressedFile = await compressSvg(file);
        } else {
          compressedFile = await compressRasterImage(file, qualityPercent);
        }

        const compressedSize = compressedFile.size;

        return {
          file,
          compressedFile,
          originalSize,
          compressedSize,
          index,
          error: null
        };
      } catch (err) {
        return {
          file,
          compressedFile: null,
          originalSize: file.size,
          compressedSize: 0,
          index,
          error: err.message
        };
      }
    }

    async function compressImages() {
      debug('Compress button clicked');

      loading.style.display = 'block';
      resultContainer.style.display = 'none';
      imageResults.innerHTML = '';
      summary.style.display = 'none';
      downloadAllContainer.style.display = 'none';

      if (selectedFiles.length === 0) {
        alert('Please upload at least one image.');
        loading.style.display = 'none';
        return;
      }

      compressedFiles = [];

      selectedFiles.forEach((file, index) => {
        const imageCard = document.createElement('div');
        imageCard.className = 'image-card';
        imageCard.id = `image-card-${index}`;
        imageCard.innerHTML = `
          <div class="image-info">
            <div class="info-item">
              <div class="info-label">File Name</div>
              <div class="info-value">${file.name}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Status</div>
              <div class="info-value">Compressing...</div>
            </div>
          </div>
          <div class="loading"></div>
        `;
        imageResults.appendChild(imageCard);
      });

      resultContainer.style.display = 'block';
      resultContainer.scrollIntoView({ behavior: 'smooth' });

      const results = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const result = await compressSingleImage(selectedFiles[i], i);
        results.push(result);

        const imageCard = document.getElementById(`image-card-${i}`);
        if (result.error) {
          imageCard.innerHTML = `
            <div class="image-info">
              <div class="info-item">
                <div class="info-label">File Name</div>
                <div class="info-value">${result.file.name}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Status</div>
                <div class="info-value">Failed: ${result.error}</div>
              </div>
            </div>
          `;
        } else {
          imageCard.innerHTML = `
            <div class="image-info">
              <div class="info-item">
                <div class="info-label">File Name</div>
                <div class="info-value">${result.file.name}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Original Size</div>
                <div class="info-value">${formatFileSize(result.originalSize)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Compressed Size</div>
                <div class="info-value">${formatFileSize(result.compressedSize)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Reduction</div>
                <div class="info-value">${((result.originalSize - result.compressedSize) / result.originalSize * 100).toFixed(2)}%</div>
              </div>
            </div>
            <div class="image-buttons">
              <button class="image-btn download-btn" data-index="${i}">Download</button>
            </div>
          `;
        }
      }

      compressedFiles = results.filter(r => !r.error).map(r => r.compressedFile);

      const totalOrig = results.reduce((sum, r) => sum + r.originalSize, 0);
      const totalComp = results.reduce((sum, r) => sum + (r.compressedSize || 0), 0);
      const reduction = totalOrig > 0 ? ((totalOrig - totalComp) / totalOrig * 100).toFixed(2) : 0;

      totalOriginalSize.textContent = formatFileSize(totalOrig);
      totalCompressedSize.textContent = formatFileSize(totalComp);
      overallReduction.textContent = `${reduction}%`;
      summary.style.display = 'block';

      if (compressedFiles.length > 0) {
        downloadAllContainer.style.display = 'block';
      }

      document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const index = parseInt(this.getAttribute('data-index'));
          const file = compressedFiles[index];
          const url = URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = url;
          a.download = `compressed_${file.name}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
      });

      downloadAllBtn.addEventListener('click', function() {
        const zip = new JSZip();
        compressedFiles.forEach((file, index) => {
          zip.file(`compressed_${file.name}`, file);
        });

        zip.generateAsync({ type: 'blob' }).then(function(content) {
          saveAs(content, 'compressed_images.zip');
        });
      });

      loading.style.display = 'none';
    }

    try {
      debug('Setting up event listeners');

      compressBtn.addEventListener('click', function(e) {
        e.preventDefault();
        compressImages();
      });

      form.addEventListener('submit', function(e) {
        e.preventDefault();
        compressImages();
      });

      debug('Event listeners set up successfully');
    } catch (err) {
      debug('Error setting up event listeners: ' + err.message);
      alert('There was a problem setting up the application. Please refresh the page.');
    }

    debug('Initialization complete');
  