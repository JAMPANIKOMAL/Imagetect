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

    // Apply saved theme on page load
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
        const fileNameSpan = $('#fileName');
        const fileNameContainer = fileNameSpan.parent();

        // Always remove scrolling class first to reset the animation
        fileNameSpan.removeClass('scrolling');

        if (originalFile) {
            fileNameSpan.text(originalFile.name);
            $('#compressBtn').prop('disabled', false);

            // Use a short timeout to allow the browser to render the new text
            // and calculate its width before checking for overflow.
            setTimeout(function() {
                if (fileNameSpan[0].scrollWidth > fileNameContainer[0].clientWidth) {
                    fileNameSpan.addClass('scrolling');
                }
            }, 100);

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
            fileNameSpan.text('No file chosen');
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

                let currentWidth = img.width;
                let currentHeight = img.height;

                const processCompressionStep = () => {
                    canvas.width = Math.round(currentWidth);
                    canvas.height = Math.round(currentHeight);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Binary search for quality
                    let minQuality = 0;
                    let maxQuality = 1;
                    let bestBlob = null;
                    const maxAttempts = 10;
                    let currentAttempt = 0;

                    const searchForBestQuality = () => {
                        if (currentAttempt >= maxAttempts) {
                            if (bestBlob && bestBlob.size <= targetSizeBytes) {
                                displayCompressedImage(bestBlob);
                                showMessage('Compression successful!', 'success');
                            } else {
                                // If still too big, resize and try again
                                if (currentWidth <= 10 || currentHeight <= 10) {
                                    if (bestBlob) {
                                        displayCompressedImage(bestBlob);
                                        showMessage('Could not reach the exact target size. This is the smallest possible result.', 'error');
                                    } else {
                                        // Fallback if no blob was ever suitable
                                        canvas.toBlob(blob => {
                                            displayCompressedImage(blob);
                                            showMessage('Could not compress further. This is the smallest possible result.', 'error');
                                        }, 'image/jpeg', 0);
                                    }
                                    return;
                                }
                                // Reduce dimensions for the next iteration
                                currentWidth *= 0.9;
                                currentHeight *= 0.9;
                                setTimeout(processCompressionStep, 50); // Next step
                            }
                            return;
                        }

                        currentAttempt++;
                        const quality = (minQuality + maxQuality) / 2;

                        canvas.toBlob(blob => {
                            if (!blob) {
                                showMessage('Error during image processing.', 'error');
                                $('#loading').hide();
                                $('#compressBtn').prop('disabled', false);
                                return;
                            }
                            
                            if (blob.size > targetSizeBytes) {
                                maxQuality = quality;
                            } else {
                                bestBlob = blob;
                                minQuality = quality;
                            }
                            searchForBestQuality();
                        }, 'image/jpeg', quality);
                    };

                    searchForBestQuality();
                };

                processCompressionStep(); // Start the process
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
