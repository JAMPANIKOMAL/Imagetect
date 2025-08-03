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
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                let minQuality = 0;
                let maxQuality = 1;
                let bestBlob = null;
                const maxAttempts = 15; // More attempts for better precision
                let currentAttempt = 0;

                // Binary search to find the best quality for the target size
                const searchForBestQuality = () => {
                    if (currentAttempt >= maxAttempts) {
                        if (bestBlob) {
                            displayCompressedImage(bestBlob);
                        } else {
                            // Fallback to the lowest quality if no suitable blob was found
                            canvas.toBlob(blob => {
                                displayCompressedImage(blob);
                                showMessage('Could not compress to the target size. Result is the smallest possible.', 'error');
                            }, 'image/jpeg', 0);
                        }
                        return;
                    }

                    currentAttempt++;
                    const quality = (minQuality + maxQuality) / 2;

                    canvas.toBlob(blob => {
                        console.log(`Attempt ${currentAttempt}: Quality ${quality.toFixed(4)}, Size ${(blob.size / 1024).toFixed(2)} KB`);

                        if (blob.size > targetSizeBytes) {
                            // If the size is too big, the max quality is now our current quality
                            maxQuality = quality;
                        } else {
                            // This is a good candidate, store it and try for even better quality
                            bestBlob = blob;
                            minQuality = quality;
                        }
                        // Continue the search
                        searchForBestQuality();

                    }, 'image/jpeg', quality);
                };

                searchForBestQuality();
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
        if (!bestBlob || blob.size > targetSizeBytes) {
             // This message is handled in the compression function now
        } else {
            showMessage('Compression successful!', 'success');
        }
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
