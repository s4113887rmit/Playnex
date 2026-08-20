document.addEventListener('DOMContentLoaded', () => {
  // Grab the textarea and the finalize button using the classes in your HTML
  const warningInput = document.querySelector('.warning-box textarea');
  const submitBtn = document.querySelector('.btn--warning-finalize');

  // Live Form Validation Logic
  const validateWarning = () => {
    let errorSpan = warningInput.nextElementSibling;
    
    // Create the error message span if it doesn't exist yet
    if (!errorSpan || !errorSpan.classList.contains('error-msg')) {
      errorSpan = document.createElement('span');
      errorSpan.classList.add('error-msg');
      errorSpan.style.color = '#e74c3c';
      errorSpan.style.fontSize = '12px';
      errorSpan.style.display = 'block';
      errorSpan.style.marginTop = '8px';
      warningInput.parentNode.insertBefore(errorSpan, warningInput.nextSibling);
    }

    // Check if the input is empty
    if (warningInput.value.trim() === '') {
      warningInput.style.borderColor = '#e74c3c';
      errorSpan.textContent = 'Warning message cannot be empty.';
      return false;
    } else {
      warningInput.style.borderColor = 'var(--border)';
      errorSpan.textContent = '';
      return true;
    }
  };

  // Trigger the validation every time the admin types a character
  warningInput.addEventListener('input', validateWarning);

  // Prevent submission if invalid
  submitBtn.addEventListener('click', (e) => {
    e.preventDefault(); // Stop default button behavior

    const isValid = validateWarning();

    if (isValid) {
      // If valid, you would normally send a POST request to your backend here.
      // For the prototype UI, we will clear the box and show a success alert.
      alert('Warning finalized and sent to user.');
      warningInput.value = ''; 
    }
  });
});