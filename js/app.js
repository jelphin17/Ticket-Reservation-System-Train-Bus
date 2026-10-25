// Main Application Coordinator for VelocityPass (Train & Bus Reservation System)
import { CITIES, TRAIN_SERVICES, BUS_SERVICES, TRAIN_CLASSES, BUS_TYPES, AMENITY_ICONS, COUPONS } from './data.js';
import { storage } from './storage.js';
import { sfx } from './audio.js';
import { SeatMapManager } from './seatmap.js';
import { BookingManager } from './booking.js';
import { PaymentManager } from './payment.js';
import { TicketManager } from './ticket.js';

// Expose reference for seatmap calculation
window.TRAIN_CLASSES_REF = TRAIN_CLASSES;
window.BUS_TYPES_REF = BUS_TYPES;

class App {
  constructor() {
    this.currentMode = 'train'; // 'train' or 'bus'
    this.currentView = 'search'; // 'search', 'results', 'seatmap', 'checkout', 'bookings', 'pnr'
    this.activeSearch = {
      from: 'NYC',
      to: 'WAS',
      date: new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0],
      classCode: 'ALL',
      sortBy: 'departure',
      maxPrice: 200,
      timeSlot: 'ALL'
    };

    this.currentService = null;
    this.currentClass = null;

    // Component instances
    this.seatMapManager = null;
    this.bookingManager = null;
    this.paymentManager = null;
    this.ticketManager = null;
  }

  init() {
    this.initTheme();
    this.initSoundToggle();
    this.initManagers();
    this.populateCityDropdowns();
    this.setupDatePresets();
    this.bindNavigation();
    this.bindSearchForm();
    this.bindFilters();
    this.bindCouponPresets();
    this.renderInitialState();
  }

  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `transithub-toast toast-${type}`;
    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span class="toast-msg">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  initTheme() {
    const savedTheme = storage.getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.innerHTML = savedTheme === 'dark' ? '☀️ Light' : '🌙 Dark';
      toggleBtn.addEventListener('click', () => {
        sfx.playPop();
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        storage.setTheme(next);
        toggleBtn.innerHTML = next === 'dark' ? '☀️ Light' : '🌙 Dark';
        this.showToast(`Switched to ${next} mode`, 'info');
      });
    }
  }

  initSoundToggle() {
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (soundBtn) {
      const updateLabel = () => {
        soundBtn.innerHTML = sfx.isMuted() ? '🔇 Muted' : '🔊 Sound On';
      };
      updateLabel();
      soundBtn.addEventListener('click', () => {
        const muted = sfx.toggleMute();
        updateLabel();
        if (!muted) sfx.playPop();
        this.showToast(muted ? 'Sound effects muted' : 'Sound effects enabled', 'info');
      });
    }
  }

  initManagers() {
    this.ticketManager = new TicketManager({
      onBookingChanged: () => {
        this.renderMyBookings();
        this.updateBadgeCounts();
      }
    });

    this.paymentManager = new PaymentManager({
      onPaymentSuccess: (paymentDetails) => {
        const payload = this.bookingManager.generateBookingPayload(paymentDetails);
        const saved = storage.saveBooking(payload);
        this.showToast(`Reservation Confirmed! PNR: ${saved.pnr}`, 'success');
        this.updateBadgeCounts();
        this.ticketManager.showTicketModal(saved);
        this.renderMyBookings();
      }
    });

    this.bookingManager = new BookingManager({
      onFareUpdated: (fare) => {
        this.renderFareSummary(fare);
      }
    });

    this.seatMapManager = new SeatMapManager({
      container: document.getElementById('seatmap-mount'),
      onSelectionChange: (seats) => {
        this.bookingManager.updateSeats(seats);
        this.renderPassengerForms();
        const continueBtn = document.getElementById('btn-proceed-passenger');
        if (continueBtn) {
          continueBtn.disabled = seats.length === 0;
          continueBtn.innerHTML = seats.length > 0 
            ? `Continue with ${seats.length} Seat${seats.length > 1 ? 's' : ''} ➔` 
            : 'Select seats on the map above';
        }
      }
    });
  }

  populateCityDropdowns() {
    const fromSelect = document.getElementById('select-from-city');
    const toSelect = document.getElementById('select-to-city');

    if (!fromSelect || !toSelect) return;

    const optionsHtml = CITIES.map(c => `
      <option value="${c.code}">${c.name} (${c.code}) - ${c.station}</option>
    `).join('');

    fromSelect.innerHTML = optionsHtml;
    toSelect.innerHTML = optionsHtml;

    fromSelect.value = 'NYC';
    toSelect.value = 'WAS';

    // Swap button
    const swapBtn = document.getElementById('btn-swap-cities');
    swapBtn?.addEventListener('click', () => {
      sfx.playPop();
      swapBtn.classList.add('spinning');
      const temp = fromSelect.value;
      fromSelect.value = toSelect.value;
      toSelect.value = temp;
      setTimeout(() => swapBtn.classList.remove('spinning'), 400);
      this.executeSearch();
    });
  }

  setupDatePresets() {
    const dateInput = document.getElementById('input-journey-date');
    const today = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];

    if (dateInput) {
      dateInput.min = formatDate(today);
      dateInput.value = formatDate(new Date(Date.now() + 24 * 3600 * 1000)); // tomorrow
    }

    // Preset buttons
    document.querySelectorAll('.date-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        sfx.playPop();
        document.querySelectorAll('.date-preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const offsetDays = parseInt(chip.getAttribute('data-days') || '0', 10);
        const targetDate = new Date(Date.now() + offsetDays * 24 * 3600 * 1000);
        if (dateInput) dateInput.value = formatDate(targetDate);
        this.executeSearch();
      });
    });
  }

  bindNavigation() {
    // Mode switcher buttons
    const modeBtns = document.querySelectorAll('.mode-toggle-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sfx.playPop();
        const mode = btn.getAttribute('data-mode');
        this.setMode(mode);
      });
    });

    // Main header tabs
    document.getElementById('nav-book-tickets')?.addEventListener('click', (e) => {
      e.preventDefault();
      sfx.playPop();
      this.switchSection('search-section');
    });

    document.getElementById('nav-my-bookings')?.addEventListener('click', (e) => {
      e.preventDefault();
      sfx.playPop();
      this.renderMyBookings();
      this.switchSection('my-bookings-section');
    });

    document.getElementById('nav-pnr-status')?.addEventListener('click', (e) => {
      e.preventDefault();
      sfx.playPop();
      this.switchSection('pnr-enquiry-section');
    });

    // PNR lookup form
    const pnrForm = document.getElementById('pnr-search-form');
    pnrForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      sfx.playPop();
      const pnrInput = document.getElementById('input-pnr-query');
      this.lookupPnr(pnrInput?.value);
    });

    // Back buttons
    document.getElementById('btn-back-to-results')?.addEventListener('click', () => {
      sfx.playPop();
      this.switchSection('search-results-section');
    });

    document.getElementById('btn-back-to-seatmap')?.addEventListener('click', () => {
      sfx.playPop();
      this.switchSection('seat-selection-section');
    });
  }

  setMode(mode) {
    this.currentMode = mode;
    document.querySelectorAll('.mode-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });

    const heroTitle = document.getElementById('hero-title');
    const heroSubtitle = document.getElementById('hero-subtitle');
    const classFilter = document.getElementById('select-class-filter');

    if (mode === 'train') {
      if (heroTitle) heroTitle.innerHTML = 'High-Speed Rail & Express Train Reservation';
      if (heroSubtitle) heroSubtitle.textContent = 'Book bullet trains, luxury sleeper berths, and intercity express coaches with zero convenience fees';
      if (classFilter) {
        classFilter.innerHTML = `
          <option value="ALL">All Train Classes</option>
          <option value="1A">1st AC Sleeper (1A)</option>
          <option value="2A">2-Tier AC Sleeper (2A)</option>
          <option value="3A">3-Tier AC Sleeper (3A)</option>
          <option value="EC">Executive Chair Car (EC)</option>
          <option value="CC">AC Chair Car (CC)</option>
          <option value="SL">Sleeper Class (SL)</option>
        `;
      }
    } else {
      if (heroTitle) heroTitle.innerHTML = 'Luxury Intercity Bus & Sleeper Coach Booking';
      if (heroSubtitle) heroSubtitle.textContent = 'Reserve Volvo 9600 Multi-Axle sleepers, Mercedes-Benz VIP coaches, and Nova electric expresses';
      if (classFilter) {
        classFilter.innerHTML = `
          <option value="ALL">All Bus Types</option>
          <option value="VOLVO_MULTI">Volvo 9600 AC Sleeper (2+1)</option>
          <option value="SCANIA_EXEC">Scania High-Deck Semi-Sleeper</option>
          <option value="MERCEDES_VIP">Mercedes-Benz VIP Club Sleeper</option>
          <option value="E_EXPRESS">Nova Electric Express</option>
        `;
      }
    }

    this.executeSearch();
  }

  switchSection(sectionId) {
    const sections = [
      'search-results-section',
      'seat-selection-section',
      'passenger-details-section',
      'my-bookings-section',
      'pnr-enquiry-section'
    ];

    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = (id === sectionId) ? 'block' : 'none';
      }
    });

    window.scrollTo({ top: document.getElementById(sectionId)?.offsetTop - 80 || 0, behavior: 'smooth' });
  }

  bindSearchForm() {
    const form = document.getElementById('main-search-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      sfx.playPop();
      this.executeSearch();
    });
  }

  bindFilters() {
    // Sort radio
    document.querySelectorAll('input[name="sort_by"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        sfx.playPop();
        this.activeSearch.sortBy = e.target.value;
        this.executeSearch();
      });
    });

    // Time filter pills
    document.querySelectorAll('.time-slot-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        sfx.playPop();
        document.querySelectorAll('.time-slot-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeSearch.timeSlot = pill.getAttribute('data-slot');
        this.executeSearch();
      });
    });

    // Price slider
    const priceRange = document.getElementById('filter-price-range');
    const priceDisplay = document.getElementById('price-range-val');
    priceRange?.addEventListener('input', (e) => {
      const val = e.target.value;
      if (priceDisplay) priceDisplay.textContent = `$${val}`;
      this.activeSearch.maxPrice = parseInt(val, 10);
      this.executeSearch();
    });
  }

  bindCouponPresets() {
    document.querySelectorAll('.coupon-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const code = pill.getAttribute('data-code');
        const input = document.getElementById('input-coupon-code');
        if (input) input.value = code;
        this.handleApplyCoupon(code);
      });
    });

    document.getElementById('btn-apply-coupon')?.addEventListener('click', () => {
      const input = document.getElementById('input-coupon-code');
      this.handleApplyCoupon(input?.value);
    });

    document.getElementById('btn-remove-coupon')?.addEventListener('click', () => {
      sfx.playPop();
      this.bookingManager.removeCoupon();
      const input = document.getElementById('input-coupon-code');
      if (input) input.value = '';
      document.getElementById('coupon-applied-badge')?.remove();
      this.showToast('Coupon removed', 'info');
    });
  }

  handleApplyCoupon(code) {
    const res = this.bookingManager.applyCoupon(code);
    if (res.success) {
      this.showToast(res.message, 'success');
      this.renderCouponBadge(res.coupon);
    } else {
      this.showToast(res.message, 'error');
    }
  }

  renderCouponBadge(coupon) {
    let badge = document.getElementById('coupon-applied-badge');
    const container = document.getElementById('coupon-badge-mount');
    if (!badge && container) {
      badge = document.createElement('div');
      badge.id = 'coupon-applied-badge';
      container.appendChild(badge);
    }
    if (badge) {
      badge.className = 'coupon-applied-tag';
      badge.innerHTML = `
        <span>🎉 <strong>${coupon.code}</strong> Applied: ${coupon.desc}</span>
        <button type="button" id="remove-coupon-mini-btn">✕</button>
      `;
      badge.querySelector('#remove-coupon-mini-btn')?.addEventListener('click', () => {
        this.bookingManager.removeCoupon();
        badge.remove();
        this.showToast('Coupon removed', 'info');
      });
    }
  }

  executeSearch() {
    const fromSelect = document.getElementById('select-from-city');
    const toSelect = document.getElementById('select-to-city');
    const dateInput = document.getElementById('input-journey-date');
    const classSelect = document.getElementById('select-class-filter');

    const fromVal = fromSelect ? fromSelect.value : 'NYC';
    const toVal = toSelect ? toSelect.value : 'WAS';
    const dateVal = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    const classVal = classSelect ? classSelect.value : 'ALL';

    this.activeSearch.from = fromVal;
    this.activeSearch.to = toVal;
    this.activeSearch.date = dateVal;
    this.activeSearch.classCode = classVal;

    let dataset = this.currentMode === 'train' ? [...TRAIN_SERVICES] : [...BUS_SERVICES];

    // Filter by route
    let results = dataset.filter(s => {
      // Direct match
      if (s.from === fromVal && s.to === toVal) return true;
      // Or if intermediate stops include both
      return false;
    });

    // If no direct service exists in sample, adapt services gracefully for realistic testing!
    if (results.length === 0) {
      results = dataset.map((s, idx) => ({
        ...s,
        id: `${s.id}-ADAPT-${idx}`,
        from: fromVal,
        to: toVal,
        departure: (s.departure || '08:00'),
        arrival: (s.arrival || '12:00')
      }));
    }

    // Attach mode flag
    results = results.map(r => ({ ...r, mode: this.currentMode }));

    // Filter by time slot
    if (this.activeSearch.timeSlot && this.activeSearch.timeSlot !== 'ALL') {
      results = results.filter(s => {
        const hour = parseInt(s.departure.split(':')[0], 10);
        if (this.activeSearch.timeSlot === 'morning') return hour >= 6 && hour < 12;
        if (this.activeSearch.timeSlot === 'afternoon') return hour >= 12 && hour < 18;
        if (this.activeSearch.timeSlot === 'night') return hour >= 18 || hour < 6;
        return true;
      });
    }

    // Filter by price
    if (this.activeSearch.maxPrice) {
      results = results.filter(s => (s.baseFare || s.fare) <= this.activeSearch.maxPrice);
    }

    // Filter by class/type
    if (this.activeSearch.classCode && this.activeSearch.classCode !== 'ALL') {
      if (this.currentMode === 'train') {
        results = results.filter(s => s.classes?.includes(this.activeSearch.classCode));
      } else {
        results = results.filter(s => s.type === this.activeSearch.classCode);
      }
    }

    // Sort
    if (this.activeSearch.sortBy === 'fare') {
      results.sort((a, b) => (a.baseFare || a.fare) - (b.baseFare || b.fare));
    } else if (this.activeSearch.sortBy === 'duration') {
      results.sort((a, b) => parseFloat(a.duration) - parseFloat(b.duration));
    } else if (this.activeSearch.sortBy === 'rating') {
      results.sort((a, b) => b.rating - a.rating);
    } else {
      // departure time
      results.sort((a, b) => a.departure.localeCompare(b.departure));
    }

    this.renderSearchResults(results);
    this.switchSection('search-results-section');
  }

  renderSearchResults(results) {
    const container = document.getElementById('search-results-list');
    const headerTitle = document.getElementById('results-count-headline');

    if (headerTitle) {
      headerTitle.innerHTML = `Found <strong>${results.length}</strong> ${this.currentMode === 'train' ? 'Trains' : 'Buses'} from <strong>${this.activeSearch.from}</strong> to <strong>${this.activeSearch.to}</strong> on ${this.activeSearch.date}`;
    }

    if (!container) return;

    if (results.length === 0) {
      container.innerHTML = `
        <div class="no-results-box">
          <div class="no-results-icon">🔍</div>
          <h3>No ${this.currentMode} services matched your filters</h3>
          <p>Try broadening your price slider, clearing specific departure time slots, or changing dates.</p>
          <button class="btn btn-outline" id="btn-reset-filters">Reset All Filters</button>
        </div>
      `;
      container.querySelector('#btn-reset-filters')?.addEventListener('click', () => {
        this.activeSearch.timeSlot = 'ALL';
        this.activeSearch.maxPrice = 200;
        this.activeSearch.classCode = 'ALL';
        this.executeSearch();
      });
      return;
    }

    container.innerHTML = results.map(service => this.createServiceCardHtml(service)).join('');

    // Attach card event listeners
    this.attachServiceCardEvents(container, results);
  }

  createServiceCardHtml(s) {
    const isTrain = s.mode === 'train';
    const startingPrice = s.baseFare || s.fare;

    return `
      <div class="service-card ${s.mode}-card" id="service-card-${s.id}">
        <div class="service-top-row">
          <div class="service-main-identity">
            <span class="service-mode-icon">${isTrain ? '🚆' : '🚌'}</span>
            <div>
              <div class="service-title-group">
                <h4 class="service-name">${s.name || s.operator}</h4>
                <span class="service-number-pill">#${s.number}</span>
                <span class="service-rating-badge">★ ${s.rating} <small>(${s.reviews})</small></span>
              </div>
              <span class="service-subtext">${s.type || s.typeName} • ${s.distance}</span>
            </div>
          </div>
          <div class="service-price-block">
            <span class="price-from-label">Fares starting at</span>
            <div class="price-amount">$${startingPrice}</div>
            <span class="seats-left-pill ${s.seatsAvailable < 15 ? 'urgent' : ''}">
              ${s.seatsAvailable || '24'} Seats Available
            </span>
          </div>
        </div>

        <!-- Schedule timeline -->
        <div class="service-schedule-row">
          <div class="sched-station dep">
            <span class="sched-time">${s.departure}</span>
            <strong class="sched-city">${s.from}</strong>
            <span class="sched-terminal">${s.stops?.[0] || s.boardingPoints?.[0] || 'Main Terminal'}</span>
          </div>

          <div class="sched-duration-indicator">
            <span class="sched-duration-text">⏱️ ${s.duration}</span>
            <div class="sched-track-line">
              <span class="point origin"></span>
              <span class="line-bar"></span>
              <span class="transit-icon">${isTrain ? '🚅' : '🚍'}</span>
              <span class="point dest"></span>
            </div>
            <span class="sched-stops-info">${s.stops ? `${s.stops.length - 2} Intermediate Stops` : 'Direct Route'}</span>
          </div>

          <div class="sched-station arr">
            <span class="sched-time">${s.arrival}</span>
            <strong class="sched-city">${s.to}</strong>
            <span class="sched-terminal">${s.stops?.[s.stops.length - 1] || s.droppingPoints?.[0] || 'Central Hub'}</span>
          </div>
        </div>

        <!-- Amenities strip -->
        <div class="service-amenities-strip">
          <div class="amenities-chips">
            ${(s.amenities || ['wifi', 'ac', 'charging']).slice(0, 5).map(key => {
              const item = AMENITY_ICONS[key] || { label: key, icon: '✨' };
              return `<span class="amenity-chip" title="${item.label}">${item.icon} ${item.label.split(' ')[0]}</span>`;
            }).join('')}
          </div>
          <div class="cancellation-badge">
            ✓ Free Cancellation Available
          </div>
        </div>

        <!-- Class selection or Direct Select Seats button -->
        <div class="service-classes-row">
          ${isTrain ? this.renderTrainClassCards(s) : this.renderBusClassCards(s)}
        </div>
      </div>
    `;
  }

  renderTrainClassCards(train) {
    return `
      <div class="classes-horizontal-list">
        ${train.classes.map(code => {
          const classMeta = TRAIN_CLASSES[code] || { name: code, multiplier: 1.0 };
          const fare = Math.round(train.baseFare * classMeta.multiplier);
          return `
            <div class="class-selector-card" data-service-id="${train.id}" data-class="${code}">
              <div class="class-head">
                <strong>${code}</strong>
                <span class="class-full-name">${classMeta.name}</span>
              </div>
              <div class="class-price">$${fare}</div>
              <div class="class-status-badge available">AVAILABLE 18</div>
              <button type="button" class="btn btn-sm btn-primary btn-select-class">Book Coach</button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderBusClassCards(bus) {
    const isSleeper = bus.type === 'VOLVO_MULTI' || bus.type === 'MERCEDES_VIP';
    return `
      <div class="bus-cta-row">
        <div class="bus-deck-info">
          <span>${isSleeper ? '🛏️ Sleeper Cabins (Upper & Lower Deck Available)' : '💺 Pushback Comfort Seats (2+2)'}</span>
          <small>Includes Clean sanitized linen, reading light & charging socket</small>
        </div>
        <button class="btn btn-primary btn-select-bus" data-service-id="${bus.id}">
          Select Bus Seats ➔
        </button>
      </div>
    `;
  }

  attachServiceCardEvents(container, results) {
    // Train class card clicks
    container.querySelectorAll('.class-selector-card').forEach(card => {
      card.addEventListener('click', () => {
        sfx.playPop();
        const serviceId = card.getAttribute('data-service-id');
        const classCode = card.getAttribute('data-class');
        const service = results.find(s => s.id === serviceId);
        if (service) {
          this.openSeatSelection(service, classCode);
        }
      });
    });

    // Bus select buttons
    container.querySelectorAll('.btn-select-bus').forEach(btn => {
      btn.addEventListener('click', () => {
        sfx.playPop();
        const serviceId = btn.getAttribute('data-service-id');
        const service = results.find(s => s.id === serviceId);
        if (service) {
          this.openSeatSelection(service, service.type);
        }
      });
    });
  }

  openSeatSelection(service, chosenClass) {
    this.currentService = service;
    this.currentClass = chosenClass;

    // Header info in seat selection section
    const banner = document.getElementById('seatmap-service-banner');
    if (banner) {
      banner.innerHTML = `
        <div class="seatmap-service-meta">
          <span class="mode-tag">${service.mode === 'train' ? '🚆 Train' : '🚌 Bus'}</span>
          <div>
            <h3>${service.name || service.operator} (${service.number})</h3>
            <span class="route-sub">${service.from} ➔ ${service.to} • ${service.departure} - ${service.arrival} (${service.duration})</span>
          </div>
        </div>
        <div class="seatmap-service-price">
          <span class="selected-class-pill">${chosenClass}</span>
          <span class="starting-label">Class Selected</span>
        </div>
      `;
    }

    // Initialize SeatMapManager
    this.seatMapManager.init(service, chosenClass);
    this.bookingManager.setBookingContext(service, chosenClass, this.activeSearch.date, []);

    // Reset passenger and checkout steps
    this.renderPassengerForms();
    this.renderFareSummary(this.bookingManager.calculateRawFare());

    const continueBtn = document.getElementById('btn-proceed-passenger');
    if (continueBtn) {
      continueBtn.disabled = true;
      continueBtn.innerHTML = 'Select seats on the map above';
      continueBtn.onclick = () => {
        if (this.seatMapManager.selectedSeats.length > 0) {
          sfx.playPop();
          this.switchSection('passenger-details-section');
        }
      };
    }

    this.switchSection('seat-selection-section');
  }

  renderPassengerForms() {
    const container = document.getElementById('passenger-forms-mount');
    if (!container) return;

    const passengers = this.bookingManager.passengers;
    if (passengers.length === 0) {
      container.innerHTML = `
        <div class="empty-passengers-notice">
          <span>👈 Please select one or more seats to enter passenger names</span>
        </div>
      `;
      return;
    }

    container.innerHTML = passengers.map((p, idx) => `
      <div class="passenger-card-box" data-index="${idx}">
        <div class="passenger-card-header">
          <span class="pax-index">Passenger ${idx + 1}</span>
          <span class="pax-seat-badge">Seat: ${p.seatLabel} (${p.berthType || 'Berth'})</span>
        </div>
        <div class="passenger-inputs-row">
          <div class="form-group flex-2">
            <label>Full Legal Name</label>
            <input type="text" class="input-pax-name" value="${p.name}" placeholder="e.g. John Doe" required />
          </div>
          <div class="form-group flex-1">
            <label>Age</label>
            <input type="number" class="input-pax-age" value="${p.age}" min="1" max="115" placeholder="Age" required />
          </div>
          <div class="form-group flex-1">
            <label>Gender</label>
            <select class="input-pax-gender">
              <option value="Male" ${p.gender === 'Male' ? 'selected' : ''}>Male</option>
              <option value="Female" ${p.gender === 'Female' ? 'selected' : ''}>Female</option>
              <option value="Non-binary" ${p.gender === 'Non-binary' ? 'selected' : ''}>Non-binary</option>
              <option value="Other" ${p.gender === 'Other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="form-group flex-1">
            <label>Meal Choice</label>
            <select class="input-pax-meal">
              <option value="Vegetarian" ${p.meal === 'Vegetarian' ? 'selected' : ''}>🥗 Vegetarian</option>
              <option value="Non-Vegetarian" ${p.meal === 'Non-Vegetarian' ? 'selected' : ''}>🍗 Non-Veg</option>
              <option value="Jain Meal" ${p.meal === 'Jain Meal' ? 'selected' : ''}>🌱 Jain Vegan</option>
              <option value="None" ${p.meal === 'None' ? 'selected' : ''}>None</option>
            </select>
          </div>
        </div>
      </div>
    `).join('');

    // Attach sync input handlers
    container.querySelectorAll('.passenger-card-box').forEach(card => {
      const idx = parseInt(card.getAttribute('data-index'), 10);
      card.querySelector('.input-pax-name')?.addEventListener('input', (e) => {
        this.bookingManager.passengers[idx].name = e.target.value;
      });
      card.querySelector('.input-pax-age')?.addEventListener('input', (e) => {
        this.bookingManager.passengers[idx].age = e.target.value;
      });
      card.querySelector('.input-pax-gender')?.addEventListener('change', (e) => {
        this.bookingManager.passengers[idx].gender = e.target.value;
      });
      card.querySelector('.input-pax-meal')?.addEventListener('change', (e) => {
        this.bookingManager.passengers[idx].meal = e.target.value;
      });
    });

    // Contact inputs sync
    const emailInput = document.getElementById('input-contact-email');
    const phoneInput = document.getElementById('input-contact-phone');

    if (emailInput) {
      if (!emailInput.value) emailInput.value = 'alex.johnson@example.com';
      this.bookingManager.contact.email = emailInput.value;
      emailInput.addEventListener('input', (e) => {
        this.bookingManager.contact.email = e.target.value;
      });
    }

    if (phoneInput) {
      if (!phoneInput.value) phoneInput.value = '+1 (555) 382-9910';
      this.bookingManager.contact.phone = phoneInput.value;
      phoneInput.addEventListener('input', (e) => {
        this.bookingManager.contact.phone = e.target.value;
      });
    }

    // Addons sync
    const insCb = document.getElementById('cb-addon-insurance');
    const carbonCb = document.getElementById('cb-addon-carbon');
    const mealCb = document.getElementById('cb-addon-meal');

    insCb?.addEventListener('change', (e) => this.bookingManager.setAddon('insurance', e.target.checked));
    carbonCb?.addEventListener('change', (e) => this.bookingManager.setAddon('carbonOffset', e.target.checked));
    mealCb?.addEventListener('change', (e) => this.bookingManager.setAddon('gourmetMeal', e.target.checked));

    // Proceed to Checkout button
    const checkoutBtn = document.getElementById('btn-proceed-checkout');
    if (checkoutBtn) {
      checkoutBtn.onclick = () => {
        sfx.playPop();
        const validation = this.bookingManager.validatePassengerDetails();
        if (!validation.valid) {
          sfx.playError();
          this.showToast(validation.message, 'error');
          return;
        }

        const fare = this.bookingManager.calculateRawFare();
        this.paymentManager.openPaymentModal(fare.grandTotal, {
          service: this.currentService,
          classCode: this.currentClass,
          seats: this.seatMapManager.selectedSeats,
          travelDate: this.activeSearch.date
        });
      };
    }
  }

  renderFareSummary(fare) {
    const mount = document.getElementById('fare-summary-mount');
    if (!mount) return;

    mount.innerHTML = `
      <div class="fare-card">
        <h4 class="fare-card-title">Fare Summary</h4>
        <div class="fare-line">
          <span>Base Ticket Fare (${fare.seatCount} Seat${fare.seatCount > 1 ? 's' : ''})</span>
          <strong>$${fare.baseSeatsTotal.toFixed(2)}</strong>
        </div>
        <div class="fare-line">
          <span>Taxes & Service Fees (8%)</span>
          <span>$${fare.taxes.toFixed(2)}</span>
        </div>
        <div class="fare-line">
          <span>Convenience Fee</span>
          <span>$${fare.convenienceFee.toFixed(2)}</span>
        </div>
        ${fare.insuranceTotal > 0 ? `
          <div class="fare-line">
            <span>Travel Insurance</span>
            <span>$${fare.insuranceTotal.toFixed(2)}</span>
          </div>
        ` : ''}
        ${fare.carbonTotal > 0 ? `
          <div class="fare-line">
            <span>Carbon Neutral Pledge</span>
            <span>$${fare.carbonTotal.toFixed(2)}</span>
          </div>
        ` : ''}
        ${fare.mealTotal > 0 ? `
          <div class="fare-line">
            <span>Gourmet Catering Upgrade</span>
            <span>$${fare.mealTotal.toFixed(2)}</span>
          </div>
        ` : ''}
        ${fare.discount > 0 ? `
          <div class="fare-line discount-line">
            <span>Promo Discount (${fare.couponCode})</span>
            <span class="discount-val">-$${fare.discount.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="fare-divider"></div>
        <div class="fare-line total-line">
          <span>Total Amount Payable</span>
          <span class="grand-total-val">$${fare.grandTotal.toFixed(2)}</span>
        </div>
      </div>
    `;
  }

  renderMyBookings() {
    const container = document.getElementById('my-bookings-list');
    if (!container) return;

    const bookings = storage.getBookings();
    if (bookings.length === 0) {
      container.innerHTML = `
        <div class="no-bookings-placeholder">
          <div class="placeholder-icon">🎫</div>
          <h3>No reservations made yet</h3>
          <p>Search trains or luxury buses above to make your first booking!</p>
          <button class="btn btn-primary" id="btn-start-booking-now">Search Tickets Now</button>
        </div>
      `;
      container.querySelector('#btn-start-booking-now')?.addEventListener('click', () => {
        this.switchSection('search-results-section');
      });
      return;
    }

    container.innerHTML = bookings.map(b => `
      <div class="booking-history-card ${b.status.toLowerCase()}">
        <div class="bcard-header">
          <div class="bcard-id-block">
            <span class="bcard-mode-badge">${b.mode === 'train' ? '🚆 Train' : '🚌 Bus'}</span>
            <span class="bcard-pnr">PNR: <strong>${b.pnr}</strong></span>
          </div>
          <div class="bcard-status-chip ${b.status.toLowerCase()}">
            ${b.status === 'CONFIRMED' ? '🟢 CONFIRMED' : '🔴 CANCELLED'}
          </div>
        </div>

        <div class="bcard-body">
          <div class="bcard-service-info">
            <h4>${b.service.name} (${b.service.number})</h4>
            <div class="bcard-route-strip">
              <span class="bcard-station">${b.service.from} (${b.service.departure})</span>
              <span class="bcard-arrow">➔ ${b.service.duration} ➔</span>
              <span class="bcard-station">${b.service.to} (${b.service.arrival})</span>
            </div>
            <span class="bcard-date">Travel Date: <strong>${b.travelDate}</strong></span>
          </div>

          <div class="bcard-passenger-summary">
            <span class="bcard-label">PASSENGERS (${b.passengers.length})</span>
            <div class="pax-names-pills">
              ${b.passengers.map(p => `
                <span class="pax-pill">${p.name} (Seat ${p.seat})</span>
              `).join('')}
            </div>
            <span class="bcard-fare-tag">Paid: <strong>$${b.fare.totalPaid.toFixed(2)}</strong></span>
          </div>
        </div>

        <div class="bcard-actions">
          <button class="btn btn-outline btn-sm btn-view-ticket" data-pnr="${b.pnr}">
            🎫 View E-Ticket
          </button>
          <button class="btn btn-outline btn-sm btn-track-bcard" data-pnr="${b.pnr}">
            📍 Live Radar
          </button>
          ${b.status !== 'CANCELLED' ? `
            <button class="btn btn-danger-outline btn-sm btn-cancel-bcard" data-pnr="${b.pnr}">
              Cancel & Refund
            </button>
          ` : `
            <span class="refund-processed-note">Refund of $${b.cancellation?.refundAmount || ''} Credited</span>
          `}
        </div>
      </div>
    `).join('');

    // Attach listeners
    container.querySelectorAll('.btn-view-ticket').forEach(btn => {
      btn.addEventListener('click', () => {
        sfx.playPop();
        const pnr = btn.getAttribute('data-pnr');
        const booking = storage.getBookingByPnr(pnr);
        if (booking) this.ticketManager.showTicketModal(booking);
      });
    });

    container.querySelectorAll('.btn-track-bcard').forEach(btn => {
      btn.addEventListener('click', () => {
        sfx.playPop();
        const pnr = btn.getAttribute('data-pnr');
        const booking = storage.getBookingByPnr(pnr);
        if (booking) this.ticketManager.showTrackerModal(booking);
      });
    });

    container.querySelectorAll('.btn-cancel-bcard').forEach(btn => {
      btn.addEventListener('click', () => {
        sfx.playPop();
        const pnr = btn.getAttribute('data-pnr');
        const booking = storage.getBookingByPnr(pnr);
        if (booking) {
          const confirmed = confirm(`Cancel booking ${pnr}?\nRefund of $${(booking.fare.totalPaid * 0.85).toFixed(2)} will be initiated.`);
          if (confirmed) {
            const res = storage.cancelBooking(pnr);
            if (res.success) {
              sfx.playSuccess();
              this.showToast(`Booking ${pnr} cancelled. Refund processed.`, 'info');
              this.renderMyBookings();
              this.updateBadgeCounts();
            }
          }
        }
      });
    });
  }

  lookupPnr(query) {
    if (!query) {
      this.showToast('Please enter a PNR number (e.g. TRN-884920)', 'error');
      return;
    }
    const clean = query.trim().toUpperCase();
    const booking = storage.getBookingByPnr(clean);
    const container = document.getElementById('pnr-enquiry-result');
    if (!container) return;

    if (!booking) {
      sfx.playError();
      container.innerHTML = `
        <div class="pnr-not-found-card">
          <div class="not-found-icon">❓</div>
          <h4>No reservation found for PNR: "${clean}"</h4>
          <p>Please check the PNR printed on your ticket or try sample PNRs: <code>TRN-884920</code> or <code>BUS-621840</code>.</p>
        </div>
      `;
      return;
    }

    sfx.playSuccess();
    container.innerHTML = `
      <div class="pnr-found-card ${booking.status.toLowerCase()}">
        <div class="pnr-card-header">
          <div>
            <span class="pnr-label">PNR STATUS ENQUIRY</span>
            <h3>${booking.pnr} • ${booking.status}</h3>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-open-ticket-from-pnr">View Full Ticket ➔</button>
        </div>

        <div class="pnr-journey-overview">
          <div class="col">
            <span class="lbl">SERVICE</span>
            <strong>${booking.service.name} (${booking.service.number})</strong>
          </div>
          <div class="col">
            <span class="lbl">DATE OF JOURNEY</span>
            <strong>${booking.travelDate}</strong>
          </div>
          <div class="col">
            <span class="lbl">ROUTE</span>
            <strong>${booking.service.from} ➔ ${booking.service.to}</strong>
          </div>
          <div class="col">
            <span class="lbl">COACH / SEATS</span>
            <strong>${booking.seats.join(', ')} (${booking.service.coach})</strong>
          </div>
        </div>

        <!-- Visual Stepper -->
        <div class="pnr-stepper-tracker">
          <div class="step completed">
            <div class="step-circle">✓</div>
            <span class="step-title">Booking Confirmed</span>
            <small>Payment Approved</small>
          </div>
          <div class="step-line completed"></div>
          <div class="step completed">
            <div class="step-circle">✓</div>
            <span class="step-title">Chart Prepared</span>
            <small>Coach & Berths Allocated</small>
          </div>
          <div class="step-line active"></div>
          <div class="step active">
            <div class="step-circle pulse">📍</div>
            <span class="step-title">In Transit</span>
            <small>Running on Schedule</small>
          </div>
          <div class="step-line"></div>
          <div class="step pending">
            <div class="step-circle">🏁</div>
            <span class="step-title">Arrival</span>
            <small>On Platform ${booking.service.platform}</small>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#btn-open-ticket-from-pnr')?.addEventListener('click', () => {
      sfx.playPop();
      this.ticketManager.showTicketModal(booking);
    });
  }

  updateBadgeCounts() {
    const bookings = storage.getBookings();
    const count = bookings.filter(b => b.status === 'CONFIRMED').length;
    const badge = document.getElementById('my-bookings-count-badge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  }

  renderInitialState() {
    this.updateBadgeCounts();
    this.executeSearch();
  }
}

// Instantiate on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
