$(document).ready(function () {
    // --- Theme Toggle Logic ---
    const applyTheme = (theme) => {
        $('body').removeClass('dark-mode light-mode').addClass(theme);
        localStorage.setItem('theme', theme);
    };

    $('#themeToggle').on('change', function () {
        if ($(this).is(':checked')) {
            applyTheme('dark-mode');
        } else {
            applyTheme('light-mode');
        }
    });

    if (localStorage.getItem('theme') === 'light-mode') {
        $('#themeToggle').prop('checked', false);
        applyTheme('light-mode');
    } else {
        $('#themeToggle').prop('checked', true);
        applyTheme('dark-mode');
    }

    // --- Compressor Logic ---
    let originalFile = null;

    $('#imageUpload').on('change', function(e) {
        originalFile = e.target.files[0];
        if (originalFile) {
            $('#fileName').text(originalFile.name);
            $('#compressBtn').prop('disabled', false);

            const reader = new FileReader();
            reader.onload = function(event) {
                $('#originalImage').attr('src', event.target.result).show();
                const sizeInKB = (originalFile.size / 1024).toFixed(2);
                const sizeInMB = (sizeInKB / 1024).toFixed(2);
                $('#originalSize').text(`Size: ${sizeInKB} KB / ${sizeInMB} MB`);
            }
            reader.readAsDataURL(originalFile);
            
            // Clear previous compressed results
            resetCompressedView();

        } else {
            $('#fileName').text('No file chosen');
            $('#compressBtn').prop('disabled', true);
            $('#originalImage').hide();
            $('#originalSize').text('');
            resetCompressedView();
        }
    });

    $('#compressBtn').on('click', function() {
        const targetSize = $('#targetSize').val();
        if (!originalFile) {
            showMessage('Please upload an image first.', 'error');
            return;
        }
        if (!targetSize || targetSize <= 0) {
            showMessage('Please enter a valid target size.', 'error');
            return;
        }

        const sizeUnit = $('#sizeUnit').val();
        let targetSizeBytes = sizeUnit === 'MB' ? targetSize * 1024 * 1024 : targetSize * 1024;
        
        if (originalFile.size <= targetSizeBytes) {
            showMessage('Target size must be smaller than the original image size.', 'error');
            return;
        }

        $('#loading').show();
        $('#compressBtn').prop('disabled', true);
        resetCompressedView();

        compressImage(originalFile, targetSizeBytes);
    });

    function compressImage(file, targetSizeBytes) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                let quality = 0.9;
                let attempts = 10; // Max attempts to find the right size

                // Function to perform a compression attempt
                const tryCompression = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);

                    canvas.toBlob(blob => {
                        console.log(`Attempt with quality ${quality.toFixed(2)}: Size = ${(blob.size / 1024).toFixed(2)} KB`);

                        if (blob.size > targetSizeBytes && attempts > 0) {
                            quality -= 0.1; // Reduce quality
                            if (quality < 0.1) quality = 0.1; // Minimum quality
                            attempts--;
                            // Use a timeout to avoid blocking the UI thread on many attempts
                            setTimeout(tryCompression, 100);
                        } else {
                            displayCompressedImage(blob);
                        }
                    }, 'image/jpeg', quality);
                };
                
                tryCompression();
            };
            img.onerror = () => {
                showMessage('Failed to load the image for compression.', 'error');
                $('#loading').hide();
                $('#compressBtn').prop('disabled', false);
            };
        };
        reader.onerror = () => {
            showMessage('Failed to read the file.', 'error');
            $('#loading').hide();
            $('#compressBtn').prop('disabled', false);
        };
    }

    function displayCompressedImage(blob) {
        const url = URL.createObjectURL(blob);
        $('#compressedImage').attr('src', url).show();

        const sizeInKB = (blob.size / 1024).toFixed(2);
        const sizeInMB = (sizeInKB / 1024).toFixed(2);
        $('#compressedSize').text(`Size: ${sizeInKB} KB / ${sizeInMB} MB`);
        
        $('#downloadLink').attr('href', url).attr('download', `compressed_${originalFile.name}`).show();
        
        $('#loading').hide();
        $('#compressBtn').prop('disabled', false);
        showMessage('Compression successful!', 'success');
    }

    function resetCompressedView() {
        $('#compressedImage').hide().attr('src', '#');
        $('#compressedSize').text('');
        $('#downloadLink').hide();
        $('#messageBox').hide().text('');
    }

    function showMessage(message, type) {
        const messageBox = $('#messageBox');
        messageBox.text(message)
                  .removeClass('error success')
                  .addClass(type)
                  .show();
        setTimeout(() => messageBox.fadeOut(), 5000);
    }
});