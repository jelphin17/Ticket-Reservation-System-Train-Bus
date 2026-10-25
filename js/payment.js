// Payment Gateway Simulator with 3D Interactive Card & UPI QR Code
import { sfx } from './audio.js';

export class PaymentManager {
  constructor(options = {}) {
    this.container = options.container;
    this.onPaymentSuccess = options.onPaymentSuccess || (() => {});
    this.currentMethod = 'card';
    this.timerInterval = null;
    this.timeLeft = 300; // 5 minutes for QR
  }

  openPaymentModal(grandTotal, bookingDetails) {
    this.grandTotal = grandTotal;
    this.bookingDetails = bookingDetails;
    this.renderModal();
    const modalEl = document.getElementById('payment-modal');
    if (modalEl) {
      modalEl.classList.add('active');
      document.body.classList.add('modal-open');
    }
  }

  closePaymentModal() {
    const modalEl = document.getElementById('payment-modal');
    if (modalEl) {
      modalEl.classList.remove('active');
      document.body.classList.remove('modal-open');
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  renderModal() {
    let modalEl = document.getElementById('payment-modal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'payment-modal';
      modalEl.className = 'transithub-modal-backdrop';
      document.body.appendChild(modalEl);
    }

    modalEl.innerHTML = `
      <div class="modal-dialog payment-dialog">
        <div class="modal-header">
          <div class="payment-header-title">
            <span class="security-badge">🔒 256-Bit SSL Encrypted Checkout</span>
            <h3>Complete Reservation Payment</h3>
          </div>
          <button class="modal-close-btn" id="close-payment-btn" title="Close Checkout">✕</button>
        </div>

        <div class="payment-order-summary-strip">
          <div class="summary-service-info">
            <span class="service-tag">${this.bookingDetails?.service?.mode === 'train' ? '🚆 Train' : '🚌 Bus'}</span>
            <strong>${this.bookingDetails?.service?.name} (${this.bookingDetails?.service?.number})</strong>
            <span class="journey-path">${this.bookingDetails?.service?.from} ➔ ${this.bookingDetails?.service?.to}</span>
          </div>
          <div class="summary-amount-box">
            <span class="label">Amount Payable:</span>
            <span class="amount-val">$${this.grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <div class="payment-tabs-bar">
          <button class="pay-tab-btn ${this.currentMethod === 'card' ? 'active' : ''}" data-method="card">
            💳 Credit / Debit Card
          </button>
          <button class="pay-tab-btn ${this.currentMethod === 'upi' ? 'active' : ''}" data-method="upi">
            📱 UPI / QR Code
          </button>
          <button class="pay-tab-btn ${this.currentMethod === 'netbanking' ? 'active' : ''}" data-method="netbanking">
            🏦 Net Banking
          </button>
          <button class="pay-tab-btn ${this.currentMethod === 'wallet' ? 'active' : ''}" data-method="wallet">
            👛 Wallets / Apple Pay
          </button>
        </div>

        <div class="payment-body-content" id="payment-tab-content">
          ${this.getTabContentHtml()}
        </div>

        <div class="payment-footer-actions">
          <button type="button" class="btn btn-secondary" id="cancel-checkout-btn">Cancel</button>
          <button type="button" class="btn btn-primary btn-pay-now" id="submit-pay-btn">
            <span class="btn-text">Pay $${this.grandTotal.toFixed(2)} & Confirm Seats</span>
            <span class="btn-spinner" style="display: none;"></span>
          </button>
        </div>
      </div>
    `;

    this.attachEvents(modalEl);
  }

  getTabContentHtml() {
    if (this.currentMethod === 'card') {
      return `
        <div class="card-payment-view">
          <!-- 3D Flippable Credit Card -->
          <div class="flip-card-wrapper" id="flip-card">
            <div class="flip-card-inner">
              <!-- Front -->
              <div class="flip-card-front">
                <div class="card-chip-strip">
                  <div class="chip-graphic"></div>
                  <div class="contactless-icon">🛜</div>
                  <div class="card-brand" id="card-brand-logo">VISA</div>
                </div>
                <div class="card-display-number" id="preview-card-num">•••• •••• •••• 4242</div>
                <div class="card-display-bottom">
                  <div class="card-holder-col">
                    <span class="card-mini-label">CARDHOLDER</span>
                    <span class="card-display-name" id="preview-card-name">ALEX JOHNSON</span>
                  </div>
                  <div class="card-expiry-col">
                    <span class="card-mini-label">EXPIRES</span>
                    <span class="card-display-expiry" id="preview-card-expiry">12/28</span>
                  </div>
                </div>
              </div>

              <!-- Back -->
              <div class="flip-card-back">
                <div class="card-magstripe"></div>
                <div class="card-cvv-strip">
                  <span class="cvv-label">CVV / CVC</span>
                  <div class="card-display-cvv" id="preview-card-cvv">•••</div>
                </div>
                <div class="card-back-disclaimer">
                  This simulated virtual card is secured with mock biometric authorization.
                </div>
              </div>
            </div>
          </div>

          <!-- Card Form Inputs -->
          <div class="card-inputs-grid">
            <div class="form-group full-width">
              <label>Cardholder Name</label>
              <input type="text" id="input-card-name" placeholder="Name on card" value="Alex Johnson" required />
            </div>
            <div class="form-group full-width">
              <label>Card Number</label>
              <input type="text" id="input-card-num" placeholder="4532 8920 1204 4242" maxlength="19" value="4532 8920 1204 4242" required />
            </div>
            <div class="form-group half-width">
              <label>Expiry Date</label>
              <input type="text" id="input-card-expiry" placeholder="MM/YY" maxlength="5" value="12/28" required />
            </div>
            <div class="form-group half-width">
              <label>CVV / CVC</label>
              <input type="password" id="input-card-cvv" placeholder="•••" maxlength="4" value="892" required />
            </div>
          </div>
        </div>
      `;
    }

    if (this.currentMethod === 'upi') {
      return `
        <div class="upi-payment-view">
          <div class="qr-container">
            <div class="qr-box">
              <svg class="dynamic-qr-code" viewBox="0 0 100 100" width="160" height="160">
                <rect width="100" height="100" fill="#ffffff" rx="8"/>
                <!-- Corner 1 -->
                <rect x="8" y="8" width="24" height="24" fill="#0f172a" rx="3"/>
                <rect x="13" y="13" width="14" height="14" fill="#ffffff"/>
                <rect x="16" y="16" width="8" height="8" fill="#0f172a"/>
                <!-- Corner 2 -->
                <rect x="68" y="8" width="24" height="24" fill="#0f172a" rx="3"/>
                <rect x="73" y="13" width="14" height="14" fill="#ffffff"/>
                <rect x="76" y="16" width="8" height="8" fill="#0f172a"/>
                <!-- Corner 3 -->
                <rect x="8" y="68" width="24" height="24" fill="#0f172a" rx="3"/>
                <rect x="13" y="73" width="14" height="14" fill="#ffffff"/>
                <rect x="16" y="76" width="8" height="8" fill="#0f172a"/>
                <!-- Data blocks -->
                <rect x="36" y="10" width="8" height="8" fill="#0f172a"/>
                <rect x="48" y="16" width="12" height="6" fill="#0f172a"/>
                <rect x="38" y="28" width="6" height="10" fill="#0f172a"/>
                <rect x="52" y="32" width="10" height="10" fill="#0f172a"/>
                <rect x="10" y="40" width="16" height="8" fill="#0f172a"/>
                <rect x="30" y="46" width="12" height="12" fill="#0ea5e9"/>
                <rect x="48" y="48" width="8" height="8" fill="#0f172a"/>
                <rect x="64" y="44" width="10" height="14" fill="#0f172a"/>
                <rect x="80" y="40" width="12" height="6" fill="#0f172a"/>
                <rect x="36" y="66" width="14" height="6" fill="#0f172a"/>
                <rect x="56" y="68" width="8" height="12" fill="#0ea5e9"/>
                <rect x="70" y="72" width="16" height="14" fill="#0f172a"/>
              </svg>
              <div class="qr-scanner-line"></div>
            </div>
            <div class="qr-timer-badge">
              ⏳ Code expires in: <strong id="qr-countdown">04:59</strong>
            </div>
          </div>
          <div class="upi-instructions">
            <h4>Scan using any UPI / Payment App</h4>
            <p>Scan with Google Pay, PhonePe, Paytm, or your mobile banking scanner to authorize payment of <strong>$${this.grandTotal.toFixed(2)}</strong>.</p>
            <div class="upi-apps-icons">
              <span class="app-chip">GPay</span>
              <span class="app-chip">PhonePe</span>
              <span class="app-chip">Paytm</span>
              <span class="app-chip">Apple Wallet</span>
            </div>
            <div class="upi-or-divider">OR ENTER UPI VIRTUAL ID</div>
            <div class="upi-id-input-box">
              <input type="text" id="input-upi-id" placeholder="username@oksbi / username@upi" value="alex.j@okhdfcbank" />
              <button type="button" class="btn btn-outline" id="verify-upi-btn">Verify</button>
            </div>
          </div>
        </div>
      `;
    }

    if (this.currentMethod === 'netbanking') {
      return `
        <div class="netbanking-view">
          <label class="section-label">Select Your Banking Partner</label>
          <div class="bank-grid">
            <label class="bank-option selected">
              <input type="radio" name="bank" value="Chase Bank" checked />
              <span class="bank-icon">🏛️</span>
              <span class="bank-name">Chase Bank</span>
            </label>
            <label class="bank-option">
              <input type="radio" name="bank" value="Bank of America" />
              <span class="bank-icon">🏦</span>
              <span class="bank-name">Bank of America</span>
            </label>
            <label class="bank-option">
              <input type="radio" name="bank" value="Wells Fargo" />
              <span class="bank-icon">🪙</span>
              <span class="bank-name">Wells Fargo</span>
            </label>
            <label class="bank-option">
              <input type="radio" name="bank" value="Citigroup" />
              <span class="bank-icon">🌐</span>
              <span class="bank-name">Citigroup</span>
            </label>
            <label class="bank-option">
              <input type="radio" name="bank" value="HDFC Bank" />
              <span class="bank-icon">💳</span>
              <span class="bank-name">HDFC Bank</span>
            </label>
            <label class="bank-option">
              <input type="radio" name="bank" value="State Bank" />
              <span class="bank-icon">🏢</span>
              <span class="bank-name">State Bank</span>
            </label>
          </div>
          <p class="banking-notice">You will be securely redirected to your bank's authorization page to approve the transaction.</p>
        </div>
      `;
    }

    if (this.currentMethod === 'wallet') {
      return `
        <div class="wallet-view">
          <label class="section-label">Choose Express Digital Wallet</label>
          <div class="wallet-list">
            <label class="wallet-card selected">
              <input type="radio" name="wallet" value="Apple Pay" checked />
              <span class="wallet-icon">🍎</span>
              <div class="wallet-meta">
                <strong>Apple Pay</strong>
                <span>One-touch Touch ID / Face ID payment</span>
              </div>
            </label>
            <label class="wallet-card">
              <input type="radio" name="wallet" value="Google Pay Express" />
              <span class="wallet-icon">🌐</span>
              <div class="wallet-meta">
                <strong>Google Pay Express</strong>
                <span>Fast checkout linked to Google Account</span>
              </div>
            </label>
            <label class="wallet-card">
              <input type="radio" name="wallet" value="PayPal OneTouch" />
              <span class="wallet-icon">🅿️</span>
              <div class="wallet-meta">
                <strong>PayPal Balance</strong>
                <span>Buyer Protection included</span>
              </div>
            </label>
          </div>
        </div>
      `;
    }

    return '';
  }

  attachEvents(modalEl) {
    // Close button
    modalEl.querySelector('#close-payment-btn')?.addEventListener('click', () => {
      sfx.playPop();
      this.closePaymentModal();
    });

    modalEl.querySelector('#cancel-checkout-btn')?.addEventListener('click', () => {
      sfx.playPop();
      this.closePaymentModal();
    });

    // Tab switching
    modalEl.querySelectorAll('.pay-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sfx.playPop();
        this.currentMethod = btn.getAttribute('data-method');
        modalEl.querySelectorAll('.pay-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const container = modalEl.querySelector('#payment-tab-content');
        if (container) {
          container.innerHTML = this.getTabContentHtml();
          this.bindTabInputs(modalEl);
        }
      });
    });

    this.bindTabInputs(modalEl);

    // Pay now submit
    const payBtn = modalEl.querySelector('#submit-pay-btn');
    payBtn?.addEventListener('click', () => {
      this.processPayment(payBtn);
    });
  }

  bindTabInputs(modalEl) {
    if (this.currentMethod === 'card') {
      const flipCard = modalEl.querySelector('#flip-card');
      const inputName = modalEl.querySelector('#input-card-name');
      const inputNum = modalEl.querySelector('#input-card-num');
      const inputExp = modalEl.querySelector('#input-card-expiry');
      const inputCvv = modalEl.querySelector('#input-card-cvv');

      const prevName = modalEl.querySelector('#preview-card-name');
      const prevNum = modalEl.querySelector('#preview-card-num');
      const prevExp = modalEl.querySelector('#preview-card-expiry');
      const prevCvv = modalEl.querySelector('#preview-card-cvv');
      const prevBrand = modalEl.querySelector('#card-brand-logo');

      inputName?.addEventListener('input', (e) => {
        prevName.textContent = (e.target.value.toUpperCase() || 'ALEX JOHNSON').slice(0, 22);
      });

      inputNum?.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '').slice(0, 16);
        let formatted = val.replace(/(\d{4})/g, '$1 ').trim();
        e.target.value = formatted;
        prevNum.textContent = formatted || '•••• •••• •••• 4242';

        if (val.startsWith('4')) {
          prevBrand.textContent = 'VISA';
        } else if (val.startsWith('5') || val.startsWith('2')) {
          prevBrand.textContent = 'MasterCard';
        } else if (val.startsWith('3')) {
          prevBrand.textContent = 'Amex';
        } else {
          prevBrand.textContent = 'CARD';
        }
      });

      inputExp?.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '').slice(0, 4);
        if (val.length >= 2) {
          val = val.slice(0, 2) + '/' + val.slice(2);
        }
        e.target.value = val;
        prevExp.textContent = val || '12/28';
      });

      inputCvv?.addEventListener('focus', () => {
        flipCard?.classList.add('flipped');
      });

      inputCvv?.addEventListener('blur', () => {
        flipCard?.classList.remove('flipped');
      });

      inputCvv?.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '').slice(0, 4);
        e.target.value = val;
        prevCvv.textContent = val.length ? '•'.repeat(val.length) : '•••';
      });
    }

    if (this.currentMethod === 'upi') {
      this.startQrCountdown(modalEl);
      const verifyBtn = modalEl.querySelector('#verify-upi-btn');
      verifyBtn?.addEventListener('click', () => {
        sfx.playSuccess();
        verifyBtn.textContent = '✓ Verified!';
        verifyBtn.style.color = '#10b981';
      });
    }

    if (this.currentMethod === 'netbanking') {
      modalEl.querySelectorAll('.bank-option').forEach(opt => {
        opt.addEventListener('click', () => {
          modalEl.querySelectorAll('.bank-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          sfx.playPop();
        });
      });
    }

    if (this.currentMethod === 'wallet') {
      modalEl.querySelectorAll('.wallet-card').forEach(opt => {
        opt.addEventListener('click', () => {
          modalEl.querySelectorAll('.wallet-card').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          sfx.playPop();
        });
      });
    }
  }

  startQrCountdown(modalEl) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timeLeft = 299;
    const timerDisplay = modalEl.querySelector('#qr-countdown');

    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        clearInterval(this.timerInterval);
        if (timerDisplay) timerDisplay.textContent = 'Expired';
        return;
      }
      const mins = Math.floor(this.timeLeft / 60);
      const secs = this.timeLeft % 60;
      if (timerDisplay) {
        timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  processPayment(buttonEl) {
    const textSpan = buttonEl.querySelector('.btn-text');
    const spinnerSpan = buttonEl.querySelector('.btn-spinner');

    buttonEl.disabled = true;
    if (spinnerSpan) spinnerSpan.style.display = 'inline-block';
    if (textSpan) textSpan.textContent = 'Authorizing payment with bank...';

    sfx.playPop();

    // Determine summary text
    let methodSummary = 'Credit Card (•••• 4242)';
    if (this.currentMethod === 'upi') {
      const upiId = document.getElementById('input-upi-id')?.value || 'alex.j@bank';
      methodSummary = `UPI / QR (${upiId})`;
    } else if (this.currentMethod === 'card') {
      const last4 = (document.getElementById('input-card-num')?.value || '4242').replace(/\s/g, '').slice(-4);
      methodSummary = `Card (•••• ${last4 || '4242'})`;
    } else if (this.currentMethod === 'netbanking') {
      const bank = document.querySelector('input[name="bank"]:checked')?.value || 'Net Banking';
      methodSummary = `Net Banking (${bank})`;
    } else if (this.currentMethod === 'wallet') {
      const wallet = document.querySelector('input[name="wallet"]:checked')?.value || 'Digital Wallet';
      methodSummary = `${wallet}`;
    }

    setTimeout(() => {
      if (textSpan) textSpan.textContent = 'Reserving seats & generating PNR...';
    }, 900);

    setTimeout(() => {
      if (textSpan) textSpan.textContent = 'Payment Confirmed!';
      sfx.playSuccess();
      buttonEl.style.backgroundColor = '#10b981';

      setTimeout(() => {
        this.closePaymentModal();
        this.onPaymentSuccess({
          transactionId: `TXN-${Math.floor(100000000 + Math.random() * 900000000)}`,
          methodSummary,
          amountPaid: this.grandTotal,
          timestamp: new Date().toISOString()
        });
      }, 700);
    }, 1900);
  }
}
