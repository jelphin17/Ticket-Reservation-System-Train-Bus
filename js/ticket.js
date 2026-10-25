// E-Ticket & Boarding Pass Rendering, QR Generator, PNR Tracker, and Cancellation
import { storage } from './storage.js';
import { sfx } from './audio.js';

export class TicketManager {
  constructor(options = {}) {
    this.container = options.container;
    this.onBookingChanged = options.onBookingChanged || (() => {});
  }

  showTicketModal(booking) {
    let modalEl = document.getElementById('ticket-modal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'ticket-modal';
      modalEl.className = 'transithub-modal-backdrop';
      document.body.appendChild(modalEl);
    }

    modalEl.innerHTML = `
      <div class="modal-dialog ticket-dialog">
        <div class="modal-header ticket-modal-header no-print">
          <div class="header-left">
            <span class="pnr-badge">PNR: ${booking.pnr}</span>
            <span class="booking-status-tag ${booking.status.toLowerCase()}">${booking.status}</span>
          </div>
          <div class="header-actions">
            <button class="btn btn-outline btn-sm" id="btn-print-ticket">🖨️ Print / Save PDF</button>
            <button class="btn btn-outline btn-sm" id="btn-download-json">💾 Download JSON</button>
            <button class="modal-close-btn" id="close-ticket-modal">✕</button>
          </div>
        </div>

        <div class="boarding-pass-container" id="printable-boarding-pass">
          <!-- Perforated Boarding Pass Card -->
          <div class="boarding-pass-card ${booking.mode}">
            <!-- Left Main Body -->
            <div class="pass-main-body">
              <div class="pass-brand-header">
                <div class="pass-brand">
                  <span class="brand-icon">${booking.mode === 'train' ? '🚆' : '🚌'}</span>
                  <div>
                    <h4>VelocityPass ${booking.mode === 'train' ? 'Rail Express' : 'OmniBus Travel'}</h4>
                    <span class="operator-name">${booking.service.name} (${booking.service.number})</span>
                  </div>
                </div>
                <div class="pass-class-badge">
                  <span>${booking.service.className || booking.service.classCode}</span>
                  <small>${booking.service.coach || 'Coach B1'}</small>
                </div>
              </div>

              <div class="pass-route-strip">
                <div class="station-block departure">
                  <span class="time">${booking.service.departure}</span>
                  <span class="city-name">${booking.service.from}</span>
                  <span class="station-detail">${booking.service.fromStation}</span>
                  <span class="date-tag">📅 ${booking.travelDate}</span>
                </div>

                <div class="route-duration-visual">
                  <span class="duration-text">⏱️ ${booking.service.duration}</span>
                  <div class="travel-line">
                    <span class="dot origin"></span>
                    <span class="path-track"></span>
                    <span class="transit-icon">${booking.mode === 'train' ? '🚅' : '🚍'}</span>
                    <span class="dot dest"></span>
                  </div>
                  <span class="route-type-tag">Direct Non-Stop</span>
                </div>

                <div class="station-block arrival">
                  <span class="time">${booking.service.arrival}</span>
                  <span class="city-name">${booking.service.to}</span>
                  <span class="station-detail">${booking.service.toStation}</span>
                  <span class="date-tag">📅 ${booking.travelDate}</span>
                </div>
              </div>

              <!-- Passengers Grid -->
              <div class="pass-passengers-section">
                <div class="section-title">PASSENGER DETAILS (${booking.passengers.length} SEAT${booking.passengers.length > 1 ? 'S' : ''})</div>
                <div class="passengers-table-wrapper">
                  <table class="passengers-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Passenger Name</th>
                        <th>Age / Sex</th>
                        <th>Seat / Berth</th>
                        <th>Berth Type</th>
                        <th>Meal</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${booking.passengers.map((p, idx) => `
                        <tr>
                          <td>${idx + 1}</td>
                          <td><strong>${p.name}</strong></td>
                          <td>${p.age} yrs / ${p.gender}</td>
                          <td><span class="seat-badge-highlight">${p.seat}</span></td>
                          <td>${p.berth || 'Standard'}</td>
                          <td>${p.meal || 'None'}</td>
                          <td><span class="status-confirmed-tag">CNF / Confirmed</span></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Fare & Meta Strip -->
              <div class="pass-footer-strip">
                <div class="meta-item">
                  <span class="meta-label">GATE / PLATFORM</span>
                  <span class="meta-val">${booking.service.platform}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">BOOKED ON</span>
                  <span class="meta-val">${new Date(booking.bookedAt).toLocaleDateString()}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">PAYMENT METHOD</span>
                  <span class="meta-val">${booking.fare.paymentMethod || 'Paid Online'}</span>
                </div>
                <div class="meta-item total-fare-item">
                  <span class="meta-label">TOTAL FARE PAID</span>
                  <span class="meta-val highlight">$${booking.fare.totalPaid.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <!-- Perforation Cut Line -->
            <div class="pass-perforation">
              <div class="notch notch-top"></div>
              <div class="dash-line"></div>
              <div class="notch notch-bottom"></div>
            </div>

            <!-- Right Stub -->
            <div class="pass-stub">
              <div class="stub-header">
                <h5>BOARDING PASS</h5>
                <span class="stub-pnr">PNR: ${booking.pnr}</span>
              </div>

              <div class="stub-qr-box">
                <canvas id="boarding-qr-canvas" width="130" height="130"></canvas>
                <span class="qr-scan-label">Scan at Gate Turnstile</span>
              </div>

              <div class="stub-details">
                <div class="stub-field">
                  <span>SERVICE</span>
                  <strong>${booking.service.number}</strong>
                </div>
                <div class="stub-field">
                  <span>SEATS</span>
                  <strong>${booking.seats.join(', ')}</strong>
                </div>
                <div class="stub-field">
                  <span>BOARDING</span>
                  <strong>${booking.service.departure}</strong>
                </div>
              </div>

              <!-- Barcode graphic -->
              <div class="stub-barcode">
                <div class="barcode-bars"></div>
                <span class="barcode-digits">*${booking.pnr.replace('-', '')}*</span>
              </div>
            </div>
          </div>

          <!-- Cancellation Box if Cancelled -->
          ${booking.status === 'CANCELLED' ? `
            <div class="cancellation-alert-banner">
              <div class="banner-icon">⚠️</div>
              <div class="banner-text">
                <h4>This reservation has been CANCELLED</h4>
                <p>Refund of <strong>$${booking.cancellation.refundAmount.toFixed(2)}</strong> initiated to original payment source. Refund Reference: REF-${booking.pnr.slice(4)}918.</p>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Modal Bottom Actions -->
        <div class="ticket-modal-footer no-print">
          <div class="footer-left">
            <button class="btn btn-outline" id="btn-track-journey" data-pnr="${booking.pnr}">
              📍 Live Journey Tracker
            </button>
          </div>
          <div class="footer-right">
            ${booking.status !== 'CANCELLED' ? `
              <button class="btn btn-danger-outline" id="btn-cancel-ticket" data-pnr="${booking.pnr}">
                Cancel Ticket & Request Refund
              </button>
            ` : ''}
            <button class="btn btn-secondary" id="btn-close-ticket-bottom">Close</button>
          </div>
        </div>
      </div>
    `;

    modalEl.classList.add('active');
    document.body.classList.add('modal-open');

    // Draw realistic QR Code
    this.drawQrCode(booking);

    // Attach button listeners
    this.attachTicketEvents(modalEl, booking);
  }

  drawQrCode(booking) {
    const canvas = document.getElementById('boarding-qr-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#0f172a';
    const s = 4; // module size

    // Draw QR-like pattern based on booking PNR
    const drawFinder = (x, y) => {
      ctx.fillRect(x, y, 7 * s, 7 * s);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + s, y + s, 5 * s, 5 * s);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 2 * s, y + 2 * s, 3 * s, 3 * s);
    };

    drawFinder(8, 8);
    drawFinder(w - 7 * s - 8, 8);
    drawFinder(8, h - 7 * s - 8);

    // Fill pseudo-random matrix deterministically
    let seed = 0;
    for (let i = 0; i < booking.pnr.length; i++) {
      seed = (seed * 31 + booking.pnr.charCodeAt(i)) & 0xffffff;
    }

    const random = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 4294967296;
    };

    for (let r = 0; r < 24; r++) {
      for (let c = 0; c < 24; c++) {
        // Skip finder areas
        if ((r < 8 && c < 8) || (r < 8 && c > 15) || (r > 15 && c < 8)) continue;
        if (random() > 0.48) {
          ctx.fillRect(10 + c * s, 10 + r * s, s - 0.5, s - 0.5);
        }
      }
    }
  }

  attachTicketEvents(modalEl, booking) {
    const closeBtns = [
      modalEl.querySelector('#close-ticket-modal'),
      modalEl.querySelector('#btn-close-ticket-bottom')
    ];

    closeBtns.forEach(btn => {
      btn?.addEventListener('click', () => {
        sfx.playPop();
        modalEl.classList.remove('active');
        document.body.classList.remove('modal-open');
      });
    });

    // Print
    modalEl.querySelector('#btn-print-ticket')?.addEventListener('click', () => {
      sfx.playPop();
      window.print();
    });

    // Download JSON
    modalEl.querySelector('#btn-download-json')?.addEventListener('click', () => {
      sfx.playPop();
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(booking, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `Ticket-${booking.pnr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });

    // Track Journey
    modalEl.querySelector('#btn-track-journey')?.addEventListener('click', () => {
      sfx.playPop();
      modalEl.classList.remove('active');
      this.showTrackerModal(booking);
    });

    // Cancel Ticket
    modalEl.querySelector('#btn-cancel-ticket')?.addEventListener('click', () => {
      sfx.playPop();
      const confirmed = confirm(`Are you sure you want to cancel Ticket PNR: ${booking.pnr}?\n\nAn 85% refund ($${(booking.fare.totalPaid * 0.85).toFixed(2)}) will be credited back.`);
      if (confirmed) {
        const result = storage.cancelBooking(booking.pnr);
        if (result.success) {
          sfx.playSuccess();
          alert(`Ticket ${booking.pnr} has been cancelled.\nRefund of $${result.refundAmount} has been processed.`);
          this.showTicketModal(result.booking);
          this.onBookingChanged();
        } else {
          sfx.playError();
          alert(result.message);
        }
      }
    });
  }

  showTrackerModal(booking) {
    let trackerModal = document.getElementById('tracker-modal');
    if (!trackerModal) {
      trackerModal = document.createElement('div');
      trackerModal.id = 'tracker-modal';
      trackerModal.className = 'transithub-modal-backdrop';
      document.body.appendChild(trackerModal);
    }

    const stops = booking.service.stops || [
      booking.service.fromStation || booking.service.from,
      'Way Station Alpha',
      'Interchange Junction',
      booking.service.toStation || booking.service.to
    ];

    trackerModal.innerHTML = `
      <div class="modal-dialog tracker-dialog">
        <div class="modal-header">
          <div>
            <span class="live-pulse-badge">🔴 LIVE FLEET RADAR</span>
            <h3>${booking.service.name} (${booking.service.number})</h3>
          </div>
          <button class="modal-close-btn" id="close-tracker-modal">✕</button>
        </div>

        <div class="tracker-status-bar">
          <div class="tracker-stat">
            <span class="stat-lbl">STATUS</span>
            <span class="stat-val status-on-time">ON SCHEDULE 🟢</span>
          </div>
          <div class="tracker-stat">
            <span class="stat-lbl">CURRENT SPEED</span>
            <span class="stat-val">${booking.mode === 'train' ? '128 mph' : '65 mph'}</span>
          </div>
          <div class="tracker-stat">
            <span class="stat-lbl">NEXT STOP</span>
            <span class="stat-val">${stops[1] || stops[0]} (in 18m)</span>
          </div>
          <div class="tracker-stat">
            <span class="stat-lbl">DESTINATION PLATFORM</span>
            <span class="stat-val">${booking.service.platform}</span>
          </div>
        </div>

        <div class="timeline-route-container">
          <div class="timeline-track">
            ${stops.map((stop, i) => {
              const isPast = i === 0;
              const isCurrent = i === 1;
              const isFuture = i > 1;

              return `
                <div class="timeline-station ${isPast ? 'completed' : (isCurrent ? 'active-station' : 'upcoming')}">
                  <div class="station-node">
                    ${isPast ? '✓' : (isCurrent ? (booking.mode === 'train' ? '🚆' : '🚌') : '')}
                  </div>
                  <div class="station-info">
                    <strong>${stop}</strong>
                    <span class="station-timing">
                      ${isPast ? 'Departed on time' : (isCurrent ? 'Approaching • Track 2' : 'Scheduled')}
                    </span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="tracker-footer">
          <button class="btn btn-primary" id="btn-view-ticket-from-tracker">Back to Ticket</button>
        </div>
      </div>
    `;

    trackerModal.classList.add('active');
    document.body.classList.add('modal-open');

    trackerModal.querySelector('#close-tracker-modal')?.addEventListener('click', () => {
      sfx.playPop();
      trackerModal.classList.remove('active');
      document.body.classList.remove('modal-open');
    });

    trackerModal.querySelector('#btn-view-ticket-from-tracker')?.addEventListener('click', () => {
      sfx.playPop();
      trackerModal.classList.remove('active');
      this.showTicketModal(booking);
    });
  }
}
