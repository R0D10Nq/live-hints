/**
 * Live Hints Onboarding — Interactive Controller
 * Kinetic, cinematic, no AI clichés
 */

class OnboardingController {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.selectedMode = 'job_interview_ru';
        this.hasResume = false;
        this.hasVacancy = false;

        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.initParticles();
        this.initAudioVisualizer();
        this.updateProgress();
    }

    cacheElements() {
        // Steps
        this.steps = document.querySelectorAll('.step-content');
        this.nodes = document.querySelectorAll('.orbit-node');
        this.progressBar = document.getElementById('orbit-progress');

        // Navigation
        this.btnBack = document.getElementById('btn-back');
        this.btnNext = document.getElementById('btn-next');
        this.btnSkip = document.getElementById('btn-skip');
        this.btnFinish = document.getElementById('btn-finish');
        this.stepCounter = document.getElementById('current-step');

        // Mode cards
        this.modeCards = document.querySelectorAll('.mode-card');
        this.modeContextArea = document.getElementById('mode-context-area');

        // File uploads
        this.resumeUpload = document.getElementById('resume-upload');
        this.resumeInput = document.getElementById('resume-input');
        this.vacancyUpload = document.getElementById('vacancy-upload');
        this.vacancyInput = document.getElementById('vacancy-input');
    }

    bindEvents() {
        // Navigation
        this.btnBack?.addEventListener('click', () => this.prevStep());
        this.btnNext?.addEventListener('click', () => this.nextStep());
        this.btnSkip?.addEventListener('click', () => this.nextStep());
        this.btnFinish?.addEventListener('click', () => this.finish());

        // Window controls
        document.getElementById('btn-minimize')?.addEventListener('click', () => {
            window.electronAPI?.minimizeWindow?.();
        });
        document.getElementById('btn-close')?.addEventListener('click', () => {
            window.electronAPI?.closeWindow?.();
        });

        // Mode selection
        this.modeCards.forEach(card => {
            card.addEventListener('click', () => this.selectMode(card));
            card.addEventListener('mouseenter', () => this.hoverCard(card, true));
            card.addEventListener('mouseleave', () => this.hoverCard(card, false));
        });

        // File uploads
        this.setupFileUpload(this.resumeUpload, this.resumeInput, 'resume');
        this.setupFileUpload(this.vacancyUpload, this.vacancyInput, 'vacancy');

        // Text toggles
        document.getElementById('toggle-resume-text')?.addEventListener('click', () => {
            document.getElementById('resume-text-area')?.classList.toggle('hidden');
        });
        document.getElementById('toggle-vacancy-text')?.addEventListener('click', () => {
            document.getElementById('vacancy-text-area')?.classList.toggle('hidden');
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'Enter') {
                if (this.currentStep < this.totalSteps) this.nextStep();
                else this.finish();
            } else if (e.key === 'ArrowLeft') {
                this.prevStep();
            }
        });
    }

    initParticles() {
        const container = document.getElementById('particles');
        if (!container) return;

        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 8 + 's';
            particle.style.animationDuration = (6 + Math.random() * 4) + 's';
            container.appendChild(particle);
        }
    }

    initAudioVisualizer() {
        const viz = document.getElementById('audio-viz');
        if (!viz) return;

        const bars = viz.querySelectorAll('.wave-bar');

        const animate = () => {
            if (this.currentStep !== 4) {
                requestAnimationFrame(animate);
                return;
            }

            bars.forEach((bar, i) => {
                const height = 20 + Math.random() * 60;
                bar.style.height = height + '%';
                bar.classList.toggle('active', height > 60);
            });

            setTimeout(() => requestAnimationFrame(animate), 100);
        };

        animate();
    }

    selectMode(card) {
        this.modeCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedMode = card.dataset.mode;

        // Show context area for custom mode
        if (this.selectedMode === 'custom') {
            this.modeContextArea?.classList.remove('hidden');
        } else {
            this.modeContextArea?.classList.add('hidden');
        }

        // Haptic feedback
        this.triggerHaptic();
    }

    hoverCard(card, entering) {
        if (entering) {
            const rect = card.getBoundingClientRect();
            const glow = card.querySelector('.card-glow');
            if (glow) {
                glow.style.left = rect.width / 2 - 50 + 'px';
                glow.style.top = rect.height / 2 - 50 + 'px';
            }
        }
    }

    setupFileUpload(zone, input, type) {
        if (!zone || !input) return;

        zone.addEventListener('click', () => input.click());

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this.handleFile(file, type);
        });

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleFile(file, type);
        });
    }

    handleFile(file, type) {
        const resultEl = document.getElementById(`${type}-result`);
        const filenameEl = document.getElementById(`${type}-filename`);
        const filesizeEl = document.getElementById(`${type}-filesize`);

        if (filenameEl) filenameEl.textContent = file.name;
        if (filesizeEl) filesizeEl.textContent = this.formatFileSize(file.size);
        if (resultEl) {
            resultEl.classList.remove('hidden');
            resultEl.animate([
                { opacity: 0, transform: 'translateY(10px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ], { duration: 300, easing: 'ease-out' });
        }

        if (type === 'resume') this.hasResume = true;
        if (type === 'vacancy') this.hasVacancy = true;

        this.triggerHaptic();
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    nextStep() {
        if (this.currentStep >= this.totalSteps) return;

        this.currentStep++;
        this.updateStep();
        this.triggerHaptic();
    }

    prevStep() {
        if (this.currentStep <= 1) return;

        this.currentStep--;
        this.updateStep();
        this.triggerHaptic();
    }

    updateStep() {
        // Update steps visibility
        this.steps.forEach((step, i) => {
            step.classList.toggle('active', i + 1 === this.currentStep);
        });

        // Update progress nodes
        this.nodes.forEach((node, i) => {
            const stepNum = i + 1;
            node.classList.remove('active', 'completed');
            if (stepNum === this.currentStep) {
                node.classList.add('active');
            } else if (stepNum < this.currentStep) {
                node.classList.add('completed');
            }
        });

        // Update progress bar
        this.updateProgress();

        // Update buttons
        this.updateButtons();

        // Update counter
        if (this.stepCounter) {
            this.stepCounter.textContent = this.currentStep;
        }
    }

    updateProgress() {
        if (!this.progressBar) return;
        const progress = ((this.currentStep - 1) / (this.totalSteps - 1)) * 70 + 15;
        this.progressBar.style.width = progress + '%';
    }

    updateButtons() {
        // Back button
        this.btnBack?.classList.toggle('hidden', this.currentStep === 1);

        // Next/Finish buttons
        const isLast = this.currentStep === this.totalSteps;
        this.btnNext?.classList.toggle('hidden', isLast);
        this.btnFinish?.classList.toggle('hidden', !isLast);

        // Skip button (only on step 2 and 3)
        const canSkip = this.currentStep === 2 || this.currentStep === 3;
        this.btnSkip?.classList.toggle('hidden', !canSkip);
    }

    triggerHaptic() {
        if (navigator.vibrate) {
            navigator.vibrate(8);
        }
    }

    async finish() {
        const settings = {
            mode: this.selectedMode,
            hasResume: this.hasResume,
            hasVacancy: this.hasVacancy,
            timestamp: Date.now()
        };

        // Animate finish
        this.btnFinish?.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(0.95)' },
            { transform: 'scale(1)' }
        ], { duration: 150 });

        // Send to main process
        if (window.electronAPI?.finishOnboarding) {
            await window.electronAPI.finishOnboarding(settings);
        }

        console.log('[Onboarding] Finished:', settings);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new OnboardingController();
});
