'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }

  gain() {
    return this.elevationGain;
  }
}

//////////////////////////////////////////////////////////////////////
// APPLICATION ARCHITECTURE

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const sortDivider = document.querySelector('.sort__divider');
const showSortBtns = document.querySelector('.show__sort__btns');
const validationMsg = document.querySelector('.validation__msg');
const removeAllBtn = document.querySelector('.clr__all__btn');
const overviewBtn = document.querySelector('.overview__btn');
const confirmMsg = document.querySelector('.confirmation__msg');
const yesBtn = document.querySelector('.yes__button');
const noBtn = document.querySelector('.no__button');
const sortContainer = document.querySelector('.sort__buttons__container');
const iconDiv = document.querySelector('.icon-div');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    //hide icon
    if (this.#workouts.length) iconDiv.classList.add('hide-icon');

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._removeWorkout.bind(this));
    removeAllBtn.addEventListener('click', this._showDeleteMsg);
    yesBtn.addEventListener('click', this._removeAllWorkouts.bind(this));
    noBtn.addEventListener('click', function () {
      confirmMsg.classList.add('msg__hidden');
    });
    showSortBtns.addEventListener('click', this._toggleSortBtns.bind(this));
    sortContainer.addEventListener('click', this._sortAndRender.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });

    // overview button listener
    overviewBtn.addEventListener('click', this._overview.bind(this));
  }

  _showForm(mapE) {
    // hide icon
    iconDiv.classList.add('hide-icon');

    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workoutrunning, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }
    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }
    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '?????????????' : '?????????????'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
  <li class="workout workout--${workout.type}" data-id="${workout.id}">
            <h2 class="workout__title">${workout.description}</h2>
            <div class="workout__details">
                <span class="workout__icon">${
                  workout.type === 'running' ? '?????????????' : '?????????????'
                }</span>
                <span class="workout__value">${workout.distance}</span>
                <span class="workout__unit">km</span>
            </div>
            <div class="workout__details">
                <span class="workout__icon">???</span>
                <span class="workout__value">${workout.duration}</span>
                <span class="workout__unit">min</span>
            </div>`;

    if (workout.type === 'running')
      html += `
         <div class="workout__details">
            <span class="workout__icon">??????</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
            <span class="workout__icon">????????</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
        </div>
            <div class="workout__controls">
                <button data-type="delete" class="delete">
                  <i class="demo-icon icon-trash-empty" data-id=${
                    workout.id
                  }></i>
                </button>  
              </div>
        </li>
            `;

    if (workout.type === 'cycling')
      html += `
            <div class="workout__details">
                <span class="workout__icon">??????</span>
                <span class="workout__value">${workout.speed.toFixed(1)}</span>
                <span class="workout__unit">km/h</span>
            </div>
            <div class="workout__details">
                <span class="workout__icon">???</span>
                <span class="workout__value">${workout.elevationGain}</span>
                <span class="workout__unit">m</span>
            </div>
              <div class="workout__controls">
                <button data-type="delete" class="delete">
                  <i class="demo-icon icon-trash-empty" data-id=${
                    workout.id
                  }></i>
                </button>  
              </div>
            </li>
                `;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  _findWorkout(e) {
    const workoutEl = e.target.closest('.icon-trash-empty');
    if (!workoutEl) return;
    console.log(workoutEl);
    return this.#workouts.find(work => work.id === workoutEl.dataset.id);
  }

  _removeWorkout(e) {
    const removeWorkout = this._findWorkout(e);

    if (!removeWorkout) return;

    this.#workouts = this.#workouts.filter(
      work => work.id !== removeWorkout.id
    );

    localStorage.removeItem('workouts');
    this._setLocalStorage();
    location.reload();
  }

  _removeAllWorkouts() {
    localStorage.clear();
    location.reload();

    // hide message
    confirmMsg.classList.add('msg__hidden');

    // show icon
    iconDiv.classList.remove('hide-icon');
  }

  _showDeleteMsg() {
    confirmMsg.classList.remove('msg__hidden');
  }

  _toggleSortBtns() {
    sortContainer.classList.toggle('no__height');
  }

  _overview() {
    if (this.#workouts.length === 0) return;

    // find the lowest and highest latitude and longitude so that the map boundaries match all markers
    const latitudes = this.#workouts.map(work => {
      return work.coords[0];
    });
    const longitudes = this.#workouts.map(work => {
      return work.coords[1];
    });
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLong = Math.min(...longitudes);
    const maxLong = Math.max(...longitudes);

    // match boundaries with coordinates
    this.#map.fitBounds(
      [
        [maxLat, minLong],
        [minLat, maxLong],
      ],
      { padding: [70, 70] }
    );
  }

  _sortAndRender(e) {
    const element = e.target.closest('.sort__button');
    let currentDirection = 'descending'; //default

    if (!element) return;
    const arrow = element.querySelector('.arrow');
    const type = element.dataset.type;

    // set all arrows to default state (down)
    sortContainer
      .querySelectorAll('.arrow')
      .forEach(arrow => arrow.classList.remove('arrow__up'));

    // get which direction to sort
    const typeValues = this.#workouts.map(workout => {
      return workout[type];
    });
    const sortedAscending = typeValues
      .slice()
      .sort(function (a, b) {
        return a - b;
      })
      .join('');
    const sortedDescending = typeValues
      .slice()
      .sort(function (a, b) {
        return b - a;
      })
      .join('');

    // compare sortedAscending array with values from #workout array to check how are they sorted
    // 1. case 1 ascending
    if (typeValues.join('') === sortedAscending) {
      currentDirection = 'ascending';
      arrow.classList.add('arrow__up');
    }
    // 2. case 2 descending
    if (typeValues.join('') === sortedDescending) {
      currentDirection = 'descending';
      arrow.classList.remove('arrow__up');
    }

    // sort main workouts array
    this._sortArray(this.#workouts, currentDirection, type);

    ///////// RE-RENDER ////////
    // clear rendered workouts from DOM
    containerWorkouts
      .querySelectorAll('.workout')
      .forEach(workout => workout.remove());

    // render list all again sorted
    this.#workouts.forEach(workout => {
      this._renderWorkout(workout);
    });

    // center map on the last item in array
    const lastWorkout = this.#workouts[this.#workouts.length - 1];
    this._setIntoView(lastWorkout);
  }
  _sortArray(array, currentDirection, type) {
    // sort opposite to the currentDirection
    if (currentDirection === 'ascending') {
      array.sort(function (a, b) {
        return b[type] - a[type];
      });
    }
    if (currentDirection === 'descending') {
      array.sort(function (a, b) {
        return a[type] - b[type];
      });
    }
  }

  _setIntoView(workout) {
    this.#map.setView(workout.coords, this.#mapZoomLevel);
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;
    this.#workouts = data;
    this.#workouts.forEach(workout => {
      workout =
        workout.type === 'running'
          ? Object.setPrototypeOf(workout, Running.prototype)
          : Object.setPrototypeOf(workout, Cycling.prototype);

      this._renderWorkout(workout);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
