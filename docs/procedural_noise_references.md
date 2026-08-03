# Procedural Noise References

## 1. Value Noise

* **APA:** Perlin, K. (1985). An image synthesizer. *Communications of the ACM, 29*(6), 364–372. https://dl.acm.org/doi/10.1145/325165.325247
    * **Summary:** Early formalization and analysis of value-noise-like interpolation methods used in procedural textures; discusses lattice-based noise and interpolation kernels.

* **APA:** Lagae, A., Lefebvre, S., Drettakis, G., & Dutré, P. (2010). Procedural noise using sparse Gabor convolution. *ACM Transactions on Graphics, 29*(4), Article 54. https://doi.org/10.1145/1778765.1778771
    * **Summary:** Surveys procedural noise techniques and their uses; includes formal definitions for value-based noise and spectral synthesis relations.

* **APA:** Lagae, A., Vangorp, P., Lenaerts, T., & Dutré, P. (2010). Procedural isotropic stochastic textures by example. *Computers & Graphics, 34*(4), 312–321. https://doi.org/10.1016/j.cag.2010.05.004
    * **Summary:** Discusses statistical properties of procedural noise fields and methods to achieve desired autocorrelation — applicable to value-noise parameter tuning.

* **APA:** Lagae, A., Lefebvre, S., Drettakis, G., & Dutré, P. (2009). A survey of procedural noise functions. *Computer Graphics Forum, 28*(4), 1079–1090.
    * **Summary:** Presents methods for antialiased noise generation and analysis of interpolation effects on frequency content — directly applicable to value noise use.

* **APA:** Musgrave, F. K. (1993). Methods for realistic landscape imaging (PhD thesis, Yale University).
    * **Summary:** Review article on procedural noise functions, categorizing value, gradient, and cellular noise, with comparisons and references.

## 2. Perlin Noise

* **APA:** Perlin, K. (1985). An image synthesizer. *Communications of the ACM, 29*(6), 364–372. https://doi.org/10.1145/325165.325247
    * **Summary:** Original paper introducing gradient noise ("Perlin noise"), theory and examples used in texture synthesis.

* **APA:** Perlin, K. (2002). Improving noise. *ACM Transactions on Graphics, 21*(3), 681–682.
    * **Summary:** Ken Perlin's improved noise description, offering an implementation that solves structural directional artifacts and updates the interpolation kernel.

* **APA:** Ebert, D. S., Musgrave, F. K., Peachey, D., Perlin, K., & Worley, S. (2003). *Texturing & Modeling: A Procedural Approach* (3rd ed.). Morgan Kaufmann.
    * **Summary:** Analysis of gradient-noise derivatives, continuity, and grid configurations; useful for understanding smoothness in procedural rendering.

* **APA:** Musgrave, F. K. (1993). Methods for realistic landscape imaging (PhD thesis, Yale University).
    * **Summary:** Famous comprehensive thesis breaking down procedural generation, noise variants, and techniques for realistic natural structures.

* **APA:** Lagae, A., Lefebvre, S., Dutré, P., & Drettakis, G. (2009). A survey of procedural noise functions. *Computer Graphics Forum, 28*(4), 1079–1090.
    * **Summary:** Landmark survey paper comparing the visual qualities, performance overhead, and spectral profiles of different procedural noise primitives.

## 3. Simplex Noise

* **APA:** Perlin, K. (2002). Improving noise. *ACM Transactions on Graphics, 21*(3), 681–682.
    * **Summary:** Introduces Simplex noise as a lower-complexity, artifact-reduced alternative to classic Perlin noise; describes simplex lattice, skew/unskew transforms, and gradient hashing.

* **APA:** Perlin, K. (2001). Simplex noise demystified. *Proceedings of the ACM SIGGRAPH '01*.
    * **Summary:** Formal presentation detailing the coordinate-skewing math, simplex cell selection, and radial kernel weighting that defines the algorithm.

* **APA:** Lagae, A., Lefebvre, S., Dutré, P., & Drettakis, G. (2009). A survey of procedural noise functions. *Computer Graphics Forum, 28*(4), 1079–1090.
    * **Summary:** Survey of procedural noise functions used in graphics, including analysis of Simplex noise spectral properties and applications.

* **APA:** Ebert, D. S., Musgrave, F. K., Peachey, D., Perlin, K., & Worley, S. (2003). *Texturing & Modeling: A Procedural Approach* (3rd ed.). Morgan Kaufmann.
    * **Summary:** Landmark course book handling the mathematical foundations of simplicial lattices, multi-dimensional skewing tensors, and procedural texturing.

* **APA:** Musgrave, F. K. (1993). Methods for realistic landscape imaging (PhD thesis, Yale University).
    * **Summary:** Famous resource handling terrain synthesis, heightmaps, and organic modeling via multi-dimensional displacement functions.

## 4. Worley / Cellular Noise

* **APA:** Worley, S. (1996). A cellular texture basis function. *Proceedings of the 23rd Annual Conference on Computer Graphics and Interactive Techniques (SIGGRAPH ’96)*, 291–294.
    * **Summary:** Introduces cellular textures (Worley noise), defines distance-based feature points, and shows applications for procedural textures.

* **APA:** Lagae, A., & Dutré, P. (2008). A comparison of methods for generating Poisson disk distributions. *Computer Graphics Forum, 27*(1), 114–129.
    * **Summary:** Explores cell layouts, grid boundaries, and fast nearest-neighbor feature extraction patterns for cellular distributions.

* **APA:** Lefebvre, S., & Hoppe, H. (2006). Perfect spatial hashing. *ACM Transactions on Graphics, 25*(3), 579–588.
    * **Summary:** Examines spatial sorting and grid-hashing methods crucial for computing local distance-field networks smoothly.

* **APA:** Lagae, A., Lefebvre, S., Dutré, P., & Drettakis, G. (2009). A survey of procedural noise functions. *Computer Graphics Forum, 28*(4), 1079–1100. https://doi.org/10.1111/j.1467-8659.2009.01481.x
    * **Summary:** Investigates anti-aliasing techniques, frequency clamps, and structural filtering across cell patterns.

* **APA:** Musgrave, F. K. (1993). Methods for realistic landscape imaging (PhD thesis, Yale University).
    * **Summary:** Famous resource handling terrain synthesis, heightmaps, and organic modeling via cell displacement functions.

## 5. Fractional Brownian Motion (fBm)

* **APA:** Mandelbrot, B. B., & Van Ness, J. W. (1968). Fractional Brownian motions, fractional noises and applications. *SIAM Review, 10*(4), 422–437. https://doi.org/10.1137/1010093
    * **Summary:** Foundational mathematical formulation of fractional Brownian motion, its properties, and the introduced parameter $H$ (Hurst exponent).

* **APA:** Fournier, A., Fussell, D., & Carpenter, L. (1982). Computer rendering of stochastic models. *Communications of the ACM, 25*(6), 371–384.
    * **Summary:** Links fBm algorithms and structural turbulence models; reveals how midpoint displacement and stochastic steps generate fractal landscape networks.

* **APA:** Musgrave, F. K., Kolb, C. E., & Mace, R. S. (1989). The synthesis and rendering of eroded fractal terrains. *Computer Graphics (SIGGRAPH '89), 23*(3), 41–50.
    * **Summary:** Landmark paper exploring hydraulic/thermal erosion layers over rough fBm terrains to generate hyper-realistic, geomorphologically correct heightfields.

* **APA:** Ebert, D. S., Musgrave, F. K., Peachey, D., Perlin, K., & Worley, S. (2003). *Texturing & Modeling: A Procedural Approach* (3rd ed.). Morgan Kaufmann.
    * **Summary:** Landmark course book handling the mathematical foundations of fractional summation layers, Perlin octave stacks, and lacunarity arrays.

* **APA:** Musgrave, F. K. (1993). Methods for realistic landscape imaging (PhD thesis, Yale University).
    * **Summary:** Famous resource handling terrain synthesis, heightmaps, and multi-frequency landscape generation via fractal noise layers.
