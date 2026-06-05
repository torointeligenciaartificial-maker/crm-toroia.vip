/* ==========================================================================
   Barber Shop El Castillo - Interacciones de la Web
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. EFECTO SCROLL EN CABECERA (HEADER)
  // ==========================================
  const header = document.getElementById('mainHeader');
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });


  // ==========================================
  // 2. MENÚ MÓVIL (HAMBURGER)
  // ==========================================
  const hamburger = document.getElementById('hamburgerMenu');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', !isExpanded);
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
    });

    // Cerrar menú al hacer clic en un enlace
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
      });
    });
  }


  // ==========================================
  // 3. ACTIVACIÓN DE ENLACES SEGÚN SCROLL (SCROLLSPY)
  // ==========================================
  const sections = document.querySelectorAll('section[id]');
  
  function scrollActive() {
    const scrollY = window.pageYOffset;
    
    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 100;
      const sectionId = current.getAttribute('id');
      const navLink = document.querySelector(`.nav-menu a[href*=${sectionId}]`);
      
      if (navLink) {
        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
          navLinks.forEach(l => l.classList.remove('active'));
          navLink.classList.add('active');
        }
      }
    });
  }
  window.addEventListener('scroll', scrollActive);


  // ==========================================
  // 4. FILTRADO DE SERVICIOS
  // ==========================================
  const tabButtons = document.querySelectorAll('.tab-btn');
  const serviceCards = document.querySelectorAll('.service-card');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remover clase activa de todos los botones
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterValue = btn.getAttribute('data-filter');

      serviceCards.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filterValue === 'all' || category === filterValue) {
          card.style.display = 'flex';
          // Animación de entrada
          card.style.animation = 'scaleIn 0.3s ease forwards';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });


  // ==========================================
  // 5. CALCULADORA DE PRECIOS INTERACTIVA
  // ==========================================
  const calcItems = document.querySelectorAll('.calc-item');
  const calcTotal = document.getElementById('calcTotal');
  const calcCount = document.getElementById('calcCount');
  const calcBookBtn = document.getElementById('calcBookBtn');

  let selectedServicesFromCalc = new Set();

  calcItems.forEach(item => {
    item.addEventListener('click', () => {
      item.classList.toggle('checked');
      const serviceId = item.getAttribute('data-id');
      
      if (item.classList.contains('checked')) {
        selectedServicesFromCalc.add(serviceId);
      } else {
        selectedServicesFromCalc.delete(serviceId);
      }
      
      updateCalculator();
    });
  });

  function updateCalculator() {
    let total = 0;
    let count = 0;

    calcItems.forEach(item => {
      if (item.classList.contains('checked')) {
        total += parseFloat(item.getAttribute('data-price'));
        count++;
      }
    });

    calcTotal.textContent = `${total} €`;
    calcCount.textContent = `${count} ${count === 1 ? 'servicio seleccionado' : 'servicios seleccionados'}`;
  }

  // Sincronizar calculadora con el Formulario de Reserva
  if (calcBookBtn) {
    calcBookBtn.addEventListener('click', () => {
      if (selectedServicesFromCalc.size === 0) {
        alert('Por favor, selecciona al menos un servicio en la calculadora para reservar.');
        return;
      }

      // Limpiar selecciones previas del formulario de reserva
      const bookingServiceItems = document.querySelectorAll('.booking-service-item');
      bookingServiceItems.forEach(item => {
        const serviceId = item.getAttribute('data-id');
        if (selectedServicesFromCalc.has(serviceId)) {
          item.classList.add('selected');
        } else {
          item.classList.remove('selected');
        }
      });

      // Actualizar el resumen del paso 1
      updateBookingSummary();
      
      // Ir a la sección de reservas
      document.getElementById('reservar').scrollIntoView({ behavior: 'smooth' });
      
      // Avanzar al paso 2 directamente para mejorar la experiencia
      goToStep(2);
    });
  }


  // ==========================================
  // 6. ASISTENTE DE RESERVA PASO A PASO (WIDGET)
  // ==========================================
  let currentStep = 1;
  const totalSteps = 3;

  const stepIndicators = document.querySelectorAll('.step-indicator');
  const stepContents = document.querySelectorAll('.booking-step-content');
  const btnPrev = document.getElementById('btnPrevStep');
  const btnNext = document.getElementById('btnNextStep');
  
  // Paso 1: Servicios
  const bookingServiceItems = document.querySelectorAll('.booking-service-item');
  
  // Paso 2: Profesional, Fecha y Hora
  const barberCards = document.querySelectorAll('.barber-card');
  const bookingDateInput = document.getElementById('bookingDate');
  const timeSlotButtons = document.querySelectorAll('.time-slot-btn');
  const selectedTimeInput = document.getElementById('selectedTime');
  
  // Paso 3: Contacto y Resumen
  const clientNameInput = document.getElementById('clientName');
  const clientPhoneInput = document.getElementById('clientPhone');
  const clientEmailInput = document.getElementById('clientEmail');
  
  // Resumen
  const sumServices = document.getElementById('sumServices');
  const sumBarber = document.getElementById('sumBarber');
  const sumDateTime = document.getElementById('sumDateTime');
  const sumTotal = document.getElementById('sumTotal');
  
  // Éxito / Ticket
  const bookingCard = document.getElementById('bookingCard');
  const bookingForm = document.getElementById('bookingForm');
  const bookingSuccess = document.getElementById('bookingSuccess');
  const bookingFooter = document.getElementById('bookingFooter');
  
  const ticketCode = document.getElementById('ticketCode');
  const ticketServices = document.getElementById('ticketServices');
  const ticketBarber = document.getElementById('ticketBarber');
  const ticketDateTime = document.getElementById('ticketDateTime');
  const ticketClient = document.getElementById('ticketClient');
  const ticketTotal = document.getElementById('ticketTotal');
  
  const btnResetBooking = document.getElementById('btnResetBooking');

  // Configurar la fecha mínima del input de fecha a hoy
  if (bookingDateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    let mm = today.getMonth() + 1; // Enero es 0
    let dd = today.getDate();

    if (mm < 10) mm = '0' + mm;
    if (dd < 10) dd = '0' + dd;

    const formattedToday = `${yyyy}-${mm}-${dd}`;
    bookingDateInput.setAttribute('min', formattedToday);
    bookingDateInput.value = formattedToday; // Valor por defecto
  }

  // Interacción: Selección de servicios en el formulario
  bookingServiceItems.forEach(item => {
    item.addEventListener('click', () => {
      item.classList.toggle('selected');
      updateBookingSummary();
    });
  });

  // Interacción: Selección de barbero
  barberCards.forEach(card => {
    card.addEventListener('click', () => {
      barberCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      updateBookingSummary();
    });
  });

  // Interacción: Slots de tiempo
  timeSlotButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      timeSlotButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedTimeInput.value = btn.getAttribute('data-time');
      updateBookingSummary();
    });
  });

  // Interacción: Cambio de fecha
  if (bookingDateInput) {
    bookingDateInput.addEventListener('change', () => {
      updateBookingSummary();
    });
  }

  // Botón Atrás
  btnPrev.addEventListener('click', () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  });

  // Botón Siguiente / Confirmar
  btnNext.addEventListener('click', () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        goToStep(currentStep + 1);
      } else {
        // En el último paso, confirmamos la cita
        submitBooking();
      }
    }
  });

  function goToStep(step) {
    currentStep = step;

    // Actualizar visual de pasos
    stepIndicators.forEach(indicator => {
      const indStep = parseInt(indicator.getAttribute('data-step'));
      if (indStep === currentStep) {
        indicator.className = 'step-indicator active';
      } else if (indStep < currentStep) {
        indicator.className = 'step-indicator completed';
      } else {
        indicator.className = 'step-indicator';
      }
    });

    // Actualizar contenido
    stepContents.forEach(content => {
      const conStep = parseInt(content.getAttribute('data-step'));
      if (conStep === currentStep) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });

    // Visibilidad del botón "Atrás"
    if (currentStep === 1) {
      btnPrev.style.visibility = 'hidden';
    } else {
      btnPrev.style.visibility = 'visible';
    }

    // Texto del botón "Siguiente"
    if (currentStep === totalSteps) {
      btnNext.innerHTML = `
        Confirmar Reserva
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      `;
    } else {
      btnNext.innerHTML = `
        Siguiente
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      `;
    }

    updateBookingSummary();
  }

  function validateStep(step) {
    if (step === 1) {
      const selected = document.querySelectorAll('.booking-service-item.selected');
      if (selected.length === 0) {
        alert('Por favor, selecciona al menos un servicio para continuar.');
        return false;
      }
      return true;
    }
    
    if (step === 2) {
      const activeBarber = document.querySelector('.barber-card.selected');
      const dateVal = bookingDateInput.value;
      const timeVal = selectedTimeInput.value;

      if (!activeBarber) {
        alert('Por favor, selecciona un profesional.');
        return false;
      }
      if (!dateVal) {
        alert('Por favor, selecciona una fecha válida.');
        return false;
      }
      if (!timeVal) {
        alert('Por favor, elige una hora para tu cita.');
        return false;
      }
      return true;
    }

    if (step === 3) {
      const nameVal = clientNameInput.value.trim();
      const phoneVal = clientPhoneInput.value.trim();

      if (!nameVal) {
        alert('Por favor, introduce tu nombre y apellidos.');
        clientNameInput.focus();
        return false;
      }
      if (!phoneVal) {
        alert('Por favor, introduce tu número de teléfono móvil.');
        clientPhoneInput.focus();
        return false;
      }
      
      // Validación básica de teléfono (español 9 dígitos)
      const cleanPhone = phoneVal.replace(/\s+/g, '');
      if (!/^[6789]\d{8}$/.test(cleanPhone)) {
        alert('Por favor, introduce un número de teléfono válido de 9 dígitos (ej: 600123456).');
        clientPhoneInput.focus();
        return false;
      }
      return true;
    }

    return true;
  }

  function updateBookingSummary() {
    // 1. Obtener servicios seleccionados
    const selected = document.querySelectorAll('.booking-service-item.selected');
    let total = 0;
    let serviceNames = [];

    selected.forEach(item => {
      total += parseFloat(item.getAttribute('data-price'));
      serviceNames.push(item.getAttribute('data-name'));
    });

    if (sumServices) {
      sumServices.textContent = serviceNames.length > 0 ? serviceNames.join(', ') : 'Ninguno';
    }
    if (sumTotal) {
      sumTotal.textContent = `${total} €`;
    }

    // 2. Obtener barbero
    const activeBarber = document.querySelector('.barber-card.selected');
    if (sumBarber && activeBarber) {
      const barberName = activeBarber.getAttribute('data-barber') === 'Alex' ? 'Álex' : 'Sofía';
      sumBarber.textContent = barberName;
    }

    // 3. Obtener fecha y hora
    const dateVal = bookingDateInput ? bookingDateInput.value : '';
    const timeVal = selectedTimeInput ? selectedTimeInput.value : '';
    if (sumDateTime) {
      if (dateVal && timeVal) {
        // Formatear fecha
        const dateParts = dateVal.split('-');
        const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        const options = { day: 'numeric', month: 'long' };
        const formattedDate = dateObj.toLocaleDateString('es-ES', options);
        sumDateTime.textContent = `${formattedDate} a las ${timeVal}h`;
      } else {
        sumDateTime.textContent = 'No seleccionado';
      }
    }
  }

  function submitBooking() {
    // Generar código aleatorio de ticket
    const randomCode = '#CASTILLO-' + Math.floor(1000 + Math.random() * 9000);
    
    // Obtener datos
    const selected = document.querySelectorAll('.booking-service-item.selected');
    let serviceNames = [];
    let total = 0;
    selected.forEach(item => {
      serviceNames.push(item.getAttribute('data-name'));
      total += parseFloat(item.getAttribute('data-price'));
    });

    const activeBarber = document.querySelector('.barber-card.selected');
    const barberName = activeBarber.getAttribute('data-barber') === 'Alex' ? 'Álex' : 'Sofía';
    
    const dateVal = bookingDateInput.value;
    const timeVal = selectedTimeInput.value;
    const dateParts = dateVal.split('-');
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const options = { day: 'numeric', month: 'long' };
    const formattedDate = dateObj.toLocaleDateString('es-ES', options);

    const clientName = clientNameInput.value.trim();

    // Rellenar ticket
    ticketCode.textContent = randomCode;
    ticketServices.textContent = serviceNames.join(', ');
    ticketBarber.textContent = barberName;
    ticketDateTime.textContent = `${formattedDate}, ${timeVal}h`;
    ticketClient.textContent = clientName;
    ticketTotal.textContent = `${total} €`;

    // Ocultar formulario y mostrar éxito
    bookingForm.style.display = 'none';
    bookingFooter.style.display = 'none';
    bookingSuccess.style.display = 'block';

    // Guardar en local storage (opcional, simulación de persistencia)
    const cita = {
      codigo: randomCode,
      servicios: serviceNames,
      profesional: barberName,
      fechaHora: `${formattedDate} a las ${timeVal}h`,
      total: total,
      cliente: clientName
    };
    localStorage.setItem('ultimaCitaCastillo', JSON.stringify(cita));

    // Scroll al inicio del widget
    document.getElementById('reservar').scrollIntoView({ behavior: 'smooth' });
  }

  // Reiniciar reservas
  if (btnResetBooking) {
    btnResetBooking.addEventListener('click', () => {
      // Limpiar campos de datos personales
      clientNameInput.value = '';
      clientPhoneInput.value = '';
      clientEmailInput.value = '';

      // Limpiar selecciones
      bookingServiceItems.forEach(item => item.classList.remove('selected'));
      timeSlotButtons.forEach(btn => btn.classList.remove('selected'));
      selectedTimeInput.value = '';
      
      // Reiniciar calculadora local del widget
      selectedServicesFromCalc.clear();
      calcItems.forEach(item => item.classList.remove('checked'));
      updateCalculator();

      // Mostrar de nuevo formulario
      bookingForm.style.display = 'block';
      bookingFooter.style.display = 'flex';
      bookingSuccess.style.display = 'none';

      // Volver al paso 1
      goToStep(1);
    });
  }


  // ==========================================
  // 7. CAROUSEL DE RESEÑAS
  // ==========================================
  const reviewsTrack = document.getElementById('reviewsTrack');
  const reviewCards = document.querySelectorAll('.review-slide-card');
  const dotsContainer = document.getElementById('carouselDots');

  if (reviewsTrack && reviewCards.length > 0 && dotsContainer) {
    const dotsCount = Math.max(1, reviewCards.length - getVisibleSlides() + 1);
    let currentIndex = 0;

    // Crear dots indicadores
    function setupCarousel() {
      dotsContainer.innerHTML = '';
      
      // Determinar la cantidad de dots según el tamaño de la pantalla
      const visibleSlides = getVisibleSlides();
      const numDots = Math.max(1, reviewCards.length - visibleSlides + 1);

      for (let i = 0; i < numDots; i++) {
        const dot = document.createElement('button');
        dot.className = i === 0 ? 'carousel-dot active' : 'carousel-dot';
        dot.setAttribute('aria-label', `Ir al grupo de opiniones ${i + 1}`);
        dot.addEventListener('click', () => {
          moveToSlide(i);
        });
        dotsContainer.appendChild(dot);
      }
    }

    function getVisibleSlides() {
      if (window.innerWidth <= 768) return 1;
      if (window.innerWidth <= 1024) return 2;
      return 3;
    }

    function moveToSlide(index) {
      const visibleSlides = getVisibleSlides();
      const maxIndex = reviewCards.length - visibleSlides;
      
      // Controlar límites
      currentIndex = Math.min(Math.max(0, index), maxIndex);

      const dots = document.querySelectorAll('.carousel-dot');
      dots.forEach((dot, idx) => {
        if (idx === currentIndex) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });

      // Calcular el desplazamiento
      const gap = 32; // Gap de 2rem en píxeles (aproximado)
      const slideWidth = reviewCards[0].offsetWidth;
      const offset = currentIndex * (slideWidth + gap);
      
      reviewsTrack.style.transform = `translateX(-${offset}px)`;
    }

    // Auto-rotación del carrusel
    let autoPlayTimer = setInterval(() => {
      const visibleSlides = getVisibleSlides();
      const maxIndex = reviewCards.length - visibleSlides;
      let nextIndex = currentIndex + 1;
      if (nextIndex > maxIndex) {
        nextIndex = 0;
      }
      moveToSlide(nextIndex);
    }, 6000);

    // Detener autoPlay al interactuar
    dotsContainer.addEventListener('click', () => {
      clearInterval(autoPlayTimer);
    });

    // Reajustar en resize de pantalla
    window.addEventListener('resize', () => {
      setupCarousel();
      moveToSlide(0);
    });

    setupCarousel();
  }


  // ==========================================
  // 8. EFECTO REVEAL CON SCROLL (INTERSECTION OBSERVER)
  // ==========================================
  const revealCards = document.querySelectorAll('.glass-card, .crew-card, .gallery-card');

  // Inicializar estilos de opacidad ocultos para animar con fade-in
  revealCards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
  });

  const observerOptions = {
    root: null,
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const card = entry.target;
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
        observer.unobserve(card); // Animación solo una vez
      }
    });
  }, observerOptions);

  revealCards.forEach(card => {
    observer.observe(card);
  });

});
