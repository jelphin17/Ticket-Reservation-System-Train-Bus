// Visual Interactive Seat Map Generator for Trains & Buses
import { sfx } from './audio.js';

export class SeatMapManager {
  constructor(options = {}) {
    this.container = options.container;
    this.onSelectionChange = options.onSelectionChange || (() => {});
    this.maxSeats = options.maxSeats || 6;
    this.selectedSeats = [];
    this.service = null;
    this.selectedClass = null;
    this.currentDeck = 'lower'; // for double decker bus
    this.currentCoach = 'B1';   // for trains
  }

  init(service, chosenClass) {
    this.service = service;
    this.selectedClass = chosenClass;
    this.selectedSeats = [];
    this.currentDeck = 'lower';
    this.currentCoach = (service.mode === 'train') ? this.getDefaultCoach(chosenClass) : null;
    this.render();
  }

  getDefaultCoach(classCode) {
    if (classCode === '1A') return 'H1';
    if (classCode === '2A') return 'A1';
    if (classCode === '3A') return 'B1';
    if (classCode === 'EC') return 'E1';
    if (classCode === 'CC') return 'C1';
    return 'S1';
  }

  getCoachesForClass(classCode) {
    if (classCode === '1A') return ['H1', 'H2'];
    if (classCode === '2A') return ['A1', 'A2', 'A3'];
    if (classCode === '3A') return ['B1', 'B2', 'B3', 'B4'];
    if (classCode === 'EC') return ['E1', 'E2'];
    if (classCode === 'CC') return ['C1', 'C2', 'C3'];
    return ['S1', 'S2', 'S3', 'S4'];
  }

  calculateSeatPrice(seatInfo) {
    const base = this.service.baseFare || this.service.fare || 50;
    const multiplier = (this.service.classes && this.selectedClass && window.TRAIN_CLASSES_REF?.[this.selectedClass]?.multiplier) || 1.0;
    let price = Math.round(base * multiplier);

    // Minor adjustment for premium positions (e.g. Single sleeper, Window, Lower berth)
    if (seatInfo.berthType === 'LB' || seatInfo.type === 'single-sleeper') {
      price += 4;
    } else if (seatInfo.position === 'Window') {
      price += 2;
    }
    return price;
  }

  toggleSeat(seatInfo) {
    if (seatInfo.status === 'booked' || seatInfo.status === 'female-booked') {
      sfx.playError();
      return;
    }

    const idx = this.selectedSeats.findIndex(s => s.id === seatInfo.id);
    if (idx >= 0) {
      this.selectedSeats.splice(idx, 1);
      sfx.playSeatDeselect();
    } else {
      if (this.selectedSeats.length >= this.maxSeats) {
        sfx.playError();
        alert(`You can select a maximum of ${this.maxSeats} seats per reservation.`);
        return;
      }
      this.selectedSeats.push(seatInfo);
      sfx.playSeatSelect();
    }

    this.render();
    this.onSelectionChange(this.selectedSeats);
  }

  isSeatSelected(id) {
    return this.selectedSeats.some(s => s.id === id);
  }

  render() {
    if (!this.container || !this.service) return;

    if (this.service.mode === 'train') {
      this.renderTrainCoach();
    } else {
      this.renderBusLayout();
    }
  }

  // --- TRAIN COACH RENDERING ---
  renderTrainCoach() {
    const coaches = this.getCoachesForClass(this.selectedClass);
    const isChairCar = ['CC', 'EC'].includes(this.selectedClass);

    let html = `
      <div class="seatmap-wrapper train-view">
        <div class="seatmap-header">
          <div class="coach-tabs">
            <span class="label">Select Coach:</span>
            ${coaches.map(c => `
              <button class="coach-pill ${this.currentCoach === c ? 'active' : ''}" data-coach="${c}">
                🚆 ${c}
              </button>
            `).join('')}
          </div>
          <div class="coach-info-tag">
            <span class="coach-badge">${this.selectedClass} Coach ${this.currentCoach}</span>
            <span class="coach-direction">Direction of Travel ➔</span>
          </div>
        </div>

        <div class="seat-legend">
          <div class="legend-item"><span class="legend-seat available"></span> Available</div>
          <div class="legend-item"><span class="legend-seat selected"></span> Selected (${this.selectedSeats.length}/${this.maxSeats})</div>
          <div class="legend-item"><span class="legend-seat booked"></span> Booked</div>
          <div class="legend-item"><span class="legend-seat female"></span> Reserved for Women</div>
        </div>

        <div class="train-coach-chassis">
          <div class="coach-vestibule front">
            <span>Entry / Vestibule</span>
            <div class="restroom-icon" title="Bio-Vacuum Washroom">🚻 WC</div>
          </div>

          <div class="coach-interior ${isChairCar ? 'chair-car' : 'sleeper-car'}">
            ${isChairCar ? this.renderChairCarRows() : this.renderSleeperCabins()}
          </div>

          <div class="coach-vestibule rear">
            <div class="restroom-icon" title="Bio-Vacuum Washroom">🚻 WC</div>
            <span>Pantry & Exit</span>
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
  }

  renderSleeperCabins() {
    // Generate 4 modular compartments (32 seats total per coach display)
    const cabins = [
      { num: 1, base: 1 },
      { num: 2, base: 9 },
      { num: 3, base: 17 },
      { num: 4, base: 25 }
    ];

    return cabins.map(cab => {
      const b = cab.base;
      const bTypeMap = ['LB', 'MB', 'UB', 'LB', 'MB', 'UB', 'SL', 'SU'];
      const bLabelMap = ['Lower Berth', 'Middle Berth', 'Upper Berth', 'Lower Berth', 'Middle Berth', 'Upper Berth', 'Side Lower (Window)', 'Side Upper'];

      // Generate seed booked states
      const seats = [
        { id: `${this.currentCoach}-${b}`, label: `${b}`, berthType: 'LB', title: `Lower Berth #${b}`, status: (b % 4 === 1) ? 'booked' : 'available' },
        { id: `${this.currentCoach}-${b+1}`, label: `${b+1}`, berthType: 'MB', title: `Middle Berth #${b+1}`, status: (b % 5 === 0) ? 'booked' : 'available' },
        { id: `${this.currentCoach}-${b+2}`, label: `${b+2}`, berthType: 'UB', title: `Upper Berth #${b+2}`, status: 'available' },
        { id: `${this.currentCoach}-${b+3}`, label: `${b+3}`, berthType: 'LB', title: `Lower Berth #${b+3}`, status: (b % 3 === 0) ? 'booked' : 'available' },
        { id: `${this.currentCoach}-${b+4}`, label: `${b+4}`, berthType: 'MB', title: `Middle Berth #${b+4}`, status: 'available' },
        { id: `${this.currentCoach}-${b+5}`, label: `${b+5}`, berthType: 'UB', title: `Upper Berth #${b+5}`, status: (b % 7 === 0) ? 'female-booked' : 'available' },
        { id: `${this.currentCoach}-${b+6}`, label: `${b+6}`, berthType: 'SL', title: `Side Lower Berth (Window) #${b+6}`, status: 'available' },
        { id: `${this.currentCoach}-${b+7}`, label: `${b+7}`, berthType: 'SU', title: `Side Upper Berth #${b+7}`, status: (b % 6 === 0) ? 'booked' : 'available' }
      ];

      return `
        <div class="sleeper-bay" data-bay="${cab.num}">
          <div class="bay-label">Bay ${cab.num}</div>
          <div class="bay-grid">
            <div class="main-coupe">
              <div class="berth-column left">
                ${this.renderSeatBtn(seats[0])}
                ${this.renderSeatBtn(seats[1])}
                ${this.renderSeatBtn(seats[2])}
              </div>
              <div class="coupe-window">🪟 Window</div>
              <div class="berth-column right">
                ${this.renderSeatBtn(seats[3])}
                ${this.renderSeatBtn(seats[4])}
                ${this.renderSeatBtn(seats[5])}
              </div>
            </div>
            <div class="aisle-lane">Aisle Passage</div>
            <div class="side-coupe">
              ${this.renderSeatBtn(seats[6])}
              <div class="side-window">🪟</div>
              ${this.renderSeatBtn(seats[7])}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderChairCarRows() {
    const rows = 8;
    let html = '<div class="chair-car-grid">';

    for (let r = 1; r <= rows; r++) {
      const isExec = this.selectedClass === 'EC';
      // 2x2 for EC, 3x2 for CC
      const leftSeats = isExec ? ['A', 'B'] : ['A', 'B', 'C'];
      const rightSeats = ['D', 'F'];

      html += `
        <div class="chair-row">
          <div class="row-num">${r}</div>
          <div class="seat-group left">
            ${leftSeats.map(letter => {
              const seatNo = `${r}${letter}`;
              const seatObj = {
                id: `${this.currentCoach}-${seatNo}`,
                label: seatNo,
                berthType: letter === 'A' ? 'Window' : (letter === 'C' ? 'Aisle' : 'Middle'),
                position: letter === 'A' ? 'Window' : '',
                title: `Seat ${seatNo} (${letter === 'A' ? 'Window' : 'Chair'})`,
                status: (r === 2 && letter === 'A') || (r === 5 && letter === 'D') ? 'booked' : 'available'
              };
              return this.renderSeatBtn(seatObj, 'chair');
            }).join('')}
          </div>
          <div class="aisle-lane small">Aisle</div>
          <div class="seat-group right">
            ${rightSeats.map(letter => {
              const seatNo = `${r}${letter}`;
              const seatObj = {
                id: `${this.currentCoach}-${seatNo}`,
                label: seatNo,
                berthType: letter === 'F' ? 'Window' : 'Aisle',
                position: letter === 'F' ? 'Window' : '',
                title: `Seat ${seatNo} (${letter === 'F' ? 'Window' : 'Aisle'})`,
                status: (r === 3 && letter === 'F') ? 'booked' : 'available'
              };
              return this.renderSeatBtn(seatObj, 'chair');
            }).join('')}
          </div>
        </div>
      `;
    }
    html += '</div>';
    return html;
  }

  // --- BUS LAYOUT RENDERING ---
  renderBusLayout() {
    const isDouble = this.service.deckType === 'double';
    const isSleeper = this.service.type === 'VOLVO_MULTI' || this.service.type === 'MERCEDES_VIP';

    let html = `
      <div class="seatmap-wrapper bus-view">
        <div class="seatmap-header">
          ${isDouble ? `
            <div class="deck-tabs">
              <span class="label">Deck:</span>
              <button class="deck-pill ${this.currentDeck === 'lower' ? 'active' : ''}" data-deck="lower">
                🔽 Lower Deck (Berths L1-L15)
              </button>
              <button class="deck-pill ${this.currentDeck === 'upper' ? 'active' : ''}" data-deck="upper">
                🔼 Upper Deck (Berths U1-U15)
              </button>
            </div>
          ` : `
            <div class="deck-info">
              <span class="bus-badge">${this.service.typeName || 'Deluxe AC'}</span>
              <span class="bus-seats-left">${this.service.seatsAvailable || 20} seats left</span>
            </div>
          `}
        </div>

        <div class="seat-legend">
          <div class="legend-item"><span class="legend-seat available"></span> Available</div>
          <div class="legend-item"><span class="legend-seat selected"></span> Selected (${this.selectedSeats.length}/${this.maxSeats})</div>
          <div class="legend-item"><span class="legend-seat booked"></span> Booked</div>
          <div class="legend-item"><span class="legend-seat female"></span> Ladies Seat</div>
        </div>

        <div class="bus-chassis">
          <!-- Driver & Front Cabin -->
          <div class="bus-front-cockpit">
            <div class="steering-wheel" title="Driver Cabin">☸️ Driver</div>
            <div class="passenger-door" title="Passenger Entry Door">🚪 Door</div>
          </div>

          <div class="bus-body-seats">
            ${isSleeper ? this.renderBusSleeperRows() : this.renderBusSeaterRows()}
          </div>

          <div class="bus-rear-bumper">
            <span>Rear Emergency Exit 🚨</span>
            ${this.service.amenities?.includes('restroom') ? '<span class="wc-tag">🚻 Washroom</span>' : ''}
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
  }

  renderBusSleeperRows() {
    const prefix = this.currentDeck === 'upper' ? 'U' : 'L';
    const rows = 6;
    let html = `<div class="bus-sleeper-grid deck-${this.currentDeck}">`;

    for (let r = 1; r <= rows; r++) {
      const singleSeatId = `${prefix}${r < 10 ? '0' + r : r}`;
      const doubleSeat1 = `${prefix}${(r + 6) < 10 ? '0' + (r + 6) : (r + 6)}A`;
      const doubleSeat2 = `${prefix}${(r + 6) < 10 ? '0' + (r + 6) : (r + 6)}B`;

      const singleObj = {
        id: `BUS-${singleSeatId}`,
        label: singleSeatId,
        type: 'single-sleeper',
        berthType: `${this.currentDeck === 'upper' ? 'Upper' : 'Lower'} Single Sleeper`,
        position: 'Window',
        title: `Single Sleeper ${singleSeatId} (Private Window)`,
        status: (r === 2 || r === 5) ? 'booked' : 'available'
      };

      const d1Obj = {
        id: `BUS-${doubleSeat1}`,
        label: doubleSeat1,
        type: 'double-sleeper',
        berthType: `${this.currentDeck === 'upper' ? 'Upper' : 'Lower'} Double Sleeper`,
        position: 'Aisle',
        title: `Double Sleeper ${doubleSeat1} (Aisle)`,
        status: (r === 1) ? 'female-booked' : (r === 4 ? 'booked' : 'available')
      };

      const d2Obj = {
        id: `BUS-${doubleSeat2}`,
        label: doubleSeat2,
        type: 'double-sleeper',
        berthType: `${this.currentDeck === 'upper' ? 'Upper' : 'Lower'} Double Sleeper`,
        position: 'Window',
        title: `Double Sleeper ${doubleSeat2} (Window)`,
        status: (r === 3) ? 'booked' : 'available'
      };

      html += `
        <div class="bus-berth-row">
          <div class="single-berth-col">
            ${this.renderSeatBtn(singleObj, 'sleeper-single')}
          </div>
          <div class="bus-aisle">Aisle</div>
          <div class="double-berth-col">
            ${this.renderSeatBtn(d1Obj, 'sleeper-double')}
            ${this.renderSeatBtn(d2Obj, 'sleeper-double')}
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  renderBusSeaterRows() {
    const rows = 8;
    let html = '<div class="bus-seater-grid">';

    for (let r = 1; r <= rows; r++) {
      const seats = [
        { id: `BUS-${r}A`, label: `${r}A`, berthType: 'Window Seat', position: 'Window', status: (r === 1 || r === 4) ? 'booked' : 'available' },
        { id: `BUS-${r}B`, label: `${r}B`, berthType: 'Aisle Seat', position: 'Aisle', status: (r === 1) ? 'female-booked' : 'available' },
        { id: `BUS-${r}C`, label: `${r}C`, berthType: 'Aisle Seat', position: 'Aisle', status: (r === 3) ? 'booked' : 'available' },
        { id: `BUS-${r}D`, label: `${r}D`, berthType: 'Window Seat', position: 'Window', status: (r === 6) ? 'booked' : 'available' }
      ];

      html += `
        <div class="bus-seater-row">
          <div class="row-indicator">${r}</div>
          <div class="side-seats left">
            ${this.renderSeatBtn(seats[0], 'seater')}
            ${this.renderSeatBtn(seats[1], 'seater')}
          </div>
          <div class="bus-aisle"></div>
          <div class="side-seats right">
            ${this.renderSeatBtn(seats[2], 'seater')}
            ${this.renderSeatBtn(seats[3], 'seater')}
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  renderSeatBtn(seat, variant = '') {
    const isSel = this.isSeatSelected(seat.id);
    const price = this.calculateSeatPrice(seat);
    seat.price = price;

    let classes = `seat-btn ${variant} ${seat.status}`;
    if (isSel) classes += ' selected';

    // Store seat info as JSON attribute
    const dataAttr = encodeURIComponent(JSON.stringify(seat));

    return `
      <button 
        type="button" 
        class="${classes}" 
        data-seat="${dataAttr}" 
        id="seat-${seat.id}"
        title="${seat.title || seat.id} - $${price}"
        ${seat.status === 'booked' || seat.status === 'female-booked' ? 'disabled' : ''}
      >
        <span class="seat-num">${seat.label}</span>
        <span class="seat-type">${seat.berthType || ''}</span>
        <span class="seat-price">$${price}</span>
      </button>
    `;
  }

  attachEventListeners() {
    // Coach pill clicks
    this.container.querySelectorAll('.coach-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentCoach = btn.getAttribute('data-coach');
        this.render();
      });
    });

    // Deck pill clicks
    this.container.querySelectorAll('.deck-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentDeck = btn.getAttribute('data-deck');
        this.render();
      });
    });

    // Seat button clicks
    this.container.querySelectorAll('.seat-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const data = JSON.parse(decodeURIComponent(btn.getAttribute('data-seat')));
        this.toggleSeat(data);
      });
    });
  }
}
