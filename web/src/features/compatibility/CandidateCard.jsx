import PropTypes from 'prop-types'
import Avatar from '../../components/Avatar/Avatar.jsx'
import Badge from '../../components/Badge/Badge.jsx'
import Button from '../../components/Button/Button.jsx'
import Card from '../../components/Card/Card.jsx'
import { formatBudget } from './format.js'
import styles from './CandidateCard.module.css'

export default function CandidateCard({ onOpen, profile, showScore }) {
  return (
    <Card className={styles.card}>
      <div className={styles.photo}>
        <Avatar name={profile.fullName} size="lg" src={profile.photoUrl} />
      </div>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h2 className={styles.name}>
            {profile.fullName}, {profile.age}
          </h2>
          {showScore && typeof profile.compatibilityScore === 'number' ? (
            <Badge tone="accent">{Math.round(profile.compatibilityScore)}%</Badge>
          ) : null}
        </div>

        <p className={styles.location}>
          {profile.zone || 'Zona no indicada'}
          {profile.city ? ` · ${profile.city}` : ''}
        </p>
        <p className={styles.budget}>{formatBudget(profile.budgetMin, profile.budgetMax)}</p>

        <Button className={styles.open} onClick={onOpen} variant="quiet">
          Ver perfil <span aria-hidden="true">→</span>
        </Button>
      </div>
    </Card>
  )
}

CandidateCard.propTypes = {
  onOpen: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    age: PropTypes.number,
    budgetMax: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    budgetMin: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    city: PropTypes.string,
    compatibilityScore: PropTypes.number,
    fullName: PropTypes.string.isRequired,
    photoUrl: PropTypes.string,
    userId: PropTypes.string.isRequired,
    zone: PropTypes.string,
  }).isRequired,
  showScore: PropTypes.bool.isRequired,
}
